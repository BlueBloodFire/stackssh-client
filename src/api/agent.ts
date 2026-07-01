/**
 * 智能体 API
 */
import { get, post, getRequestBaseUrl } from './request'
import { getToken } from '../stores/authStore'

export interface AiAgentConfigDTO {
  agentId: string
  agentName: string
  agentDesc: string
}

export interface CreateSessionRequestDTO {
  agentId: string
  userId: string
}

export interface CreateSessionResponseDTO {
  sessionId: string
}

export interface ChatRequestDTO {
  agentId: string
  userId: string
  sessionId: string
  message: string
  terminalSessionId?: string | null
}

export interface ReActEvent {
  event: 'text' | 'tool_call' | 'tool_result' | 'round_end' | 'done' | 'error'
  content?: string
  toolCallId?: string
  toolName?: string
  status?: string
  fullText?: string
  stepInfo?: {
    currentStep: number
    maxSteps: number
    shouldContinue: boolean
    totalToolCalls: number
  }
}

export interface ReActStep {
  stepType: 'thinking' | 'tool_call' | 'result'
  stepIndex: number
  content?: string
  toolName?: string
  toolParams?: string
  toolResult?: string
  status: 'in_progress' | 'success' | 'failure'
  error?: string
}

export async function queryAgentList(): Promise<AiAgentConfigDTO[]> {
  const res = await get<AiAgentConfigDTO[]>('/api/v1/query_ai_agent_config_list')
  if (res.code === '0000' && res.data) {
    return res.data
  }
  console.error('[agentApi] queryAgentList failed:', res.info)
  return []
}

export async function createSession(agentId: string, userId: string = 'default'): Promise<string | null> {
  const res = await post<CreateSessionResponseDTO>('/api/v1/create_session', {
    agentId,
    userId,
  })
  if (res.code === '0000' && res.data?.sessionId) {
    return res.data.sessionId
  }
  console.error('[agentApi] createSession failed:', res.info)
  return null
}

/**
 * ReAct 流式对话（SSE）
 *
 * 后端返回纯 JSON 行，不带 `data:` 前缀。
 * 关键点：收到 `done` 事件后立即结束本轮，不能只依赖底层连接关闭，
 * 否则 UI 可能一直停留在“思考中”。
 */
export function reactChatStream(
  agentId: string,
  userId: string,
  sessionId: string,
  message: string,
  onStep: (step: ReActStep) => void,
  onText: (fullText: string) => void,
  onDone: (finalContent: string) => void,
  onError: (err: string) => void,
  terminalSessionId?: string | null,
  connectionId?: string | null,
): () => void {
  const url = `${getRequestBaseUrl()}/api/v1/chat_stream`
  const controller = new AbortController()
  const toolStepMap = new Map<string, number>()
  let stepCounter = 0
  let lastFullText = ''
  let settled = false

  const finishStream = (finalContent: string) => {
    if (settled) return
    settled = true
    onDone(finalContent)
  }

  const failStream = (err: string) => {
    if (settled) return
    settled = true
    onError(err)
  }

  const processEvent = (event: ReActEvent) => {
    switch (event.event) {
      case 'text': {
        const fullText = event.fullText || event.content || ''
        lastFullText = fullText
        onText(fullText)
        break
      }

      case 'tool_call': {
        stepCounter++
        const idx = stepCounter
        if (event.toolCallId) {
          toolStepMap.set(event.toolCallId, idx)
        }
        onStep({
          stepType: 'tool_call',
          stepIndex: idx,
          toolName: event.toolName || 'unknown',
          content: `调用 ${event.toolName || 'unknown'}`,
          status: 'in_progress',
        })
        break
      }

      case 'tool_result': {
        const toolCallId = event.toolCallId || ''
        const existingIdx = toolStepMap.get(toolCallId)
        if (existingIdx !== undefined) {
          onStep({
            stepType: 'tool_call',
            stepIndex: existingIdx,
            toolName: '',
            toolResult: event.content || '',
            status: event.status === 'error' ? 'failure' : 'success',
            error: event.status === 'error' ? event.content : undefined,
          })
        } else {
          stepCounter++
          onStep({
            stepType: 'tool_call',
            stepIndex: stepCounter,
            toolResult: event.content || '',
            status: event.status === 'error' ? 'failure' : 'success',
            error: event.status === 'error' ? event.content : undefined,
          })
        }
        break
      }

      case 'round_end': {
        const info = event.stepInfo
        if (info) {
          stepCounter++
          onStep({
            stepType: 'thinking',
            stepIndex: stepCounter,
            content: `步骤 ${info.currentStep}/${info.maxSteps} · 工具调用 ${info.totalToolCalls} 次`,
            status: info.shouldContinue ? 'in_progress' : 'success',
          })
        }
        break
      }

      case 'done': {
        let finalContent = ''
        if (event.content) {
          try {
            const result = JSON.parse(event.content)
            finalContent = result.assistantContent || result.content || event.content
          } catch {
            finalContent = event.content
          }
        }

        if (finalContent) {
          lastFullText = finalContent
          onText(finalContent)
          onStep({
            stepType: 'result',
            stepIndex: ++stepCounter,
            content: finalContent,
            status: 'success',
          })
        }

        finishStream(finalContent || lastFullText)
        controller.abort()
        break
      }

      case 'error': {
        const err = event.content || '未知错误'
        onStep({
          stepType: 'result',
          stepIndex: ++stepCounter,
          error: err,
          status: 'failure',
        })
        failStream(err)
        controller.abort()
        break
      }
    }
  }

  const token = getToken()
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ agentId, userId, sessionId, message, terminalSessionId, connectionId }),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) {
        failStream(`HTTP ${res.status}: ${res.statusText}`)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        failStream('No response body')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      const read = (): void => {
        reader.read()
          .then(({ done, value }) => {
            if (done) {
              finishStream(lastFullText)
              return
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue

              try {
                processEvent(JSON.parse(trimmed) as ReActEvent)
              } catch {
                // Ignore partial/non-JSON lines between chunks.
              }
            }

            if (!settled) {
              read()
            }
          })
          .catch((err) => {
            if (err.name !== 'AbortError') {
              failStream(err.message)
            }
          })
      }

      read()
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        failStream(err.message)
      }
    })

  return () => controller.abort()
}

export function chatStream(
  agentId: string,
  userId: string,
  sessionId: string,
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  terminalSessionId?: string | null,
): () => void {
  return reactChatStream(
    agentId,
    userId,
    sessionId,
    message,
    () => {},
    onChunk,
    () => onDone(),
    onError,
    terminalSessionId,
  )
}

export interface ModelConfigDTO {
  apiKey: string
  baseUrl: string
  model: string
  completionsPath?: string
  embeddingsPath?: string
}

export async function getModelConfig(agentId: string): Promise<ModelConfigDTO | null> {
  try {
    const res = await get<ModelConfigDTO>(`/api/v1/agent-config/model/${agentId}`)
    if (res.code === '0000' && res.data) return res.data
    return null
  } catch {
    return null
  }
}

export async function updateModelConfig(agentId: string, config: ModelConfigDTO): Promise<boolean> {
  try {
    const res = await post(`/api/v1/agent-config/model/${agentId}`, config)
    return res.code === '0000'
  } catch {
    return false
  }
}

export interface McpConfigDTO {
  type: 'local' | 'sse' | 'stdio'
  name?: string
  baseUri?: string
  sseEndpoint?: string
  requestTimeout?: number
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export interface SkillsConfigDTO {
  type: 'resource' | 'directory'
  path: string
}

export interface ToolsConfigDTO {
  mcpList: McpConfigDTO[]
  skillsList: SkillsConfigDTO[]
}

export async function getToolsConfig(agentId: string): Promise<ToolsConfigDTO | null> {
  try {
    const res = await get<ToolsConfigDTO>(`/api/v1/agent-config/tools/${agentId}`)
    if (res.code === '0000' && res.data) return res.data
    return null
  } catch {
    return null
  }
}

export async function updateToolsConfig(agentId: string, config: ToolsConfigDTO): Promise<boolean> {
  try {
    const res = await post(`/api/v1/agent-config/tools/${agentId}`, config)
    return res.code === '0000'
  } catch {
    return false
  }
}
