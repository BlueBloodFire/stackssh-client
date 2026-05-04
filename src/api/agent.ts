/**
 * 智能体 API
 */
import { get, post, getBaseUrl } from './request'

export interface AiAgentConfigDTO {
  agentId: string
  agentName: string
  agentDesc: string
}

/** 创建会话请求 */
export interface CreateSessionRequestDTO {
  agentId: string
  userId: string
}

/** 创建会话响应 */
export interface CreateSessionResponseDTO {
  sessionId: string
}

/** 对话请求 */
export interface ChatRequestDTO {
  agentId: string
  userId: string
  sessionId: string
  message: string
}

/** 查询智能体列表 */
export async function queryAgentList(): Promise<AiAgentConfigDTO[]> {
  const res = await get<AiAgentConfigDTO[]>('/api/v1/query_ai_agent_config_list')
  if (res.code === '0000' && res.data) {
    return res.data
  }
  console.error('[agentApi] queryAgentList failed:', res.info)
  return []
}

/** 创建会话 */
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

/** 流式对话（SSE） */
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
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}/api/v1/chat_stream`

  const controller = new AbortController()

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, userId, sessionId, message, terminalSessionId }),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) {
        onError(`HTTP ${res.status}: ${res.statusText}`)
        return
      }
      const reader = res.body!.getReader()
      if (!reader) {
        onError('No response body')
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            onDone()
            return
          }
          buffer += decoder.decode(value, { stream: true })

          // 按换行分割，解析 JSON 事件
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留未完成的行

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            try {
              // Google ADK Event JSON 格式：{"content":{"parts":[{"text":"..."}]},...}
              const event = JSON.parse(trimmed)
              if (event.content?.parts) {
                for (const part of event.content.parts) {
                  if (part.text) {
                    onChunk(part.text)
                  }
                }
              }
            } catch {
              // 解析失败，可能是非 JSON 格式，直接输出
              onChunk(trimmed)
            }
          }
          read()
        }).catch(onError)
      }
      read()
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err.message)
      }
    })

  // 返回取消函数
  return () => controller.abort()
}