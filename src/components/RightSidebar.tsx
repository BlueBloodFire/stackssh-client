import { useRef, useEffect, useState } from 'react'
import { useThemeStore } from '../stores/themeStore'
import { useAgentStore } from '../stores/agentStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSshAgentStore } from '../stores/sshAgentStore'
import * as agentApi from '../api/agent'
import type { AgentMessage } from '../types'
import type { ReActStep } from '../api/agent'
import { ConnectionStatus } from '../types'

// ===== ReAct 步骤渲染 =====
const STEP_LABELS: Record<string, string> = {
  thinking: '💭 思考中',
  tool_call: '⚡ 工具执行',
  result: '✅ 结果',
}

const STEP_COLORS: Record<string, string> = {
  thinking: '#f59e0b',
  tool_call: '#8b5cf6',
  result: '#22c55e',
}

function ReActStepView({ step, colors }: { step: ReActStep; colors: ReturnType<typeof useThemeStore.getState>['colors'] }) {
  const label = STEP_LABELS[step.stepType] || step.stepType
  const dotColor = step.status === 'failure' ? '#ef4444' : (STEP_COLORS[step.stepType] || colors.accent)

  return (
    <div className="flex gap-2 py-1">
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
        {step.stepIndex ? (
          <div className="w-px flex-1 min-h-[8px]" style={{ backgroundColor: `${colors.border}` }} />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-medium" style={{ color: dotColor }}>{label}</span>
          {step.stepIndex && (
            <span className="text-[10px]" style={{ color: colors.textDim }}>#{step.stepIndex}</span>
          )}
        </div>
        {/* 工具执行 */}
        {step.toolName && (
          <div className="text-[11px] px-2 py-1 rounded mb-0.5" style={{
            backgroundColor: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            color: colors.accent,
            fontFamily: 'monospace',
          }}>
            {step.toolName}{step.toolParams ? `(${step.toolParams})` : ''}
          </div>
        )}
        {/* 工具结果 */}
        {step.toolResult && (
          <pre className="text-[11px] px-2 py-1 rounded mb-0.5 overflow-x-auto" style={{
            backgroundColor: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {step.toolResult.length > 500 ? step.toolResult.slice(0, 500) + '...' : step.toolResult}
          </pre>
        )}
        {/* 普通内容 */}
        {step.content && step.stepType !== 'result' && (
          <div className="text-[12px]" style={{ color: colors.textSecondary, whiteSpace: 'pre-wrap' }}>
            {step.content.length > 300 ? step.content.slice(0, 300) + '...' : step.content}
          </div>
        )}
        {/* 错误 */}
        {step.error && (
          <div className="text-[11px] px-2 py-1 rounded" style={{
            backgroundColor: '#ef444410',
            border: `1px solid #ef444430`,
            color: '#ef4444',
          }}>
            {step.error}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== 消息气泡 =====
function MessageBubble({ message }: { message: AgentMessage }) {
  const { colors } = useThemeStore()
  const isUser = message.role === 'user'

  const formatMarkdown = (text: string): string => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    // 代码块 - 使用主题色
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre style="margin:6px 0;padding:10px;border-radius:6px;overflow-x:auto;font-size:11px;font-family:'JetBrains Mono',monospace;background:${colors.bgSecondary};color:${colors.text};border:1px solid ${colors.border}"><code>${code.trim()}</code></pre>`
    })
    // 行内代码 - 使用主题色
    html = html.replace(/`([^`]+)`/g, `<code style="padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;background:${colors.bgHover};color:${colors.accent};border:1px solid ${colors.border}">$1</code>`)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\n/g, '<br/>')
    return html
  }

  // ReAct 模式消息：显示步骤时间线
  if (message.steps && message.steps.length > 0) {
    return (
      <div className="px-4 py-1.5 flex justify-start">
        <div className="w-full max-w-[88%] rounded-lg border" style={{
          backgroundColor: colors.bgTertiary,
          borderColor: colors.border,
          borderRadius: '12px 12px 12px 2px',
        }}>
          <div className="px-3 pt-2 pb-1">
            {message.steps.map((step, i) => (
              <ReActStepView key={i} step={step} colors={colors} />
            ))}
            {/* 最终结果 */}
            {message.content && (
              <div className="mt-1 pt-1" style={{ borderTop: `1px solid ${colors.border}` }}>
                <div className="text-[12px] leading-relaxed" style={{ color: colors.text, whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`px-4 py-1.5 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
      <div
        className="max-w-[88%] px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={{
          backgroundColor: isUser ? colors.accent : colors.bgTertiary,
          color: isUser ? '#fff' : colors.text,
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        }}
        dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
      />
    </div>
  )
}

// ServerTag 和 ConnectionSelectorModal 已移除（改为自动绑定）

// ===== 右侧 AI 面板 =====
interface RightSidebarProps {
  width?: number
  /** 当前激活的终端会话 ID */
  activeTerminalSessionId?: string | null
}

export function RightSidebar({ width = 400, activeTerminalSessionId }: RightSidebarProps) {
  const { colors } = useThemeStore()
  const {
    sessions,
    currentSessionId,
    inputText,
    setInputText,
    addMessage,
    updateMessage,
    updateMessageSteps,
    isLoading,
    setLoading,
    newConversation,
    agents,
    currentAgentId,
    fetchAgents,
    setCurrentAgentId,
    createServerSession,
  } = useAgentStore()

  const { connections, currentConnectionId } = useConnectionStore()
  const {
    activeBinding,
    terminalSelection,
    showAddToChatHint,
    bindTerminal,
    clearTerminalSelection,
    
  } = useSshAgentStore()

  // 启动时加载智能体列表
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [sendOnEnter, setSendOnEnter] = useState(() => {
    return localStorage.getItem('sendOnEnter') !== 'false'
  })
  const [showSendModeDropdown, setShowSendModeDropdown] = useState(false)
  const inputHeightRef = useRef<number>(120)

  // 平台检测
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const currentKeyLabel = isMac ? 'Command + Enter' : 'Ctrl + Enter'

  // 根据模式和平台生成 placeholder
  const inputPlaceholder = () => {
    if (sendOnEnter) {
      return isMac
        ? '向 WaLiSSH 提问...（Enter 发送 · Command + Enter 换行）'
        : '向 WaLiSSH 提问...（Enter 发送 · Ctrl + Enter 换行）'
    } else {
      return `向 WaLiSSH 提问...（${currentKeyLabel} 发送 · Enter 换行）`
    }
  }

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages, isLoading])

  // 自动调整输入框高度
  useEffect(() => {
    if (textareaRef.current) {
      const scrollHeight = textareaRef.current.scrollHeight
      const clientHeight = textareaRef.current.clientHeight
      if (scrollHeight > clientHeight) {
        textareaRef.current.style.height = scrollHeight + 'px'
        inputHeightRef.current = scrollHeight
      }
    }
  }, [inputText])

  // ===== 自动绑定当前 SSH 连接（改进版：连接即对话） =====
  useEffect(() => {
    const autoBindCurrentConnection = async () => {
      // 1. 没有终端会话，不绑定
      if (!activeTerminalSessionId) return

      // 2. 已绑定且是同一个终端会话，不重复绑定
      if (activeBinding?.terminalSessionId === activeTerminalSessionId) return

      // 3. 找到当前连接的服务器
      const connection = currentConnectionId
        ? connections.find((c) => c.id === currentConnectionId)
        : connections.find((c) => c.status === ConnectionStatus.CONNECTED)

      if (!connection || connection.status !== ConnectionStatus.CONNECTED) return

      // 4. 无会话则先创建
      if (!currentSessionId && currentAgentId) {
        await createServerSession(currentAgentId)
      }

      const sessionId = useAgentStore.getState().currentSessionId
      if (!sessionId) return

      // 5. 执行绑定
      const success = await bindTerminal(
        sessionId,
        activeTerminalSessionId,
        {
          connectionId: connection.id,
          connectionName: connection.name,
          host: connection.host,
          port: connection.port,
          username: connection.username,
        }
      )

      if (success) {
        console.log('[RightSidebar] Auto-bound to:', connection.name)
      }
    }

    autoBindCurrentConnection()
  }, [
    activeTerminalSessionId,
    activeBinding,
    currentConnectionId,
    connections,
    currentAgentId,
    bindTerminal,
    createServerSession,
  ])

  // handleSwitchServer 已移除 —— 服务器切换由左侧面板控制

  // ===== 处理发送消息 =====
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return
    if (!currentAgentId) return

    // 无会话则先创建
    if (!currentSessionId) {
      await createServerSession(currentAgentId)
    }
    const sessionId = currentSessionId!

    // 构建消息内容
    let messageContent = inputText

    // 如果有终端选中内容，添加到消息
    if (terminalSelection) {
      messageContent = `${inputText}\n\n---\n终端选中内容：\n\`\`\`\n${terminalSelection.text}\n\`\`\``
      clearTerminalSelection()
    }

    // 服务器上下文：优先 activeBinding，其次左侧选中的已连接服务器
    const selectedConn = activeBinding
      ? connections.find((c) => c.id === activeBinding.connectionId)
      : connections.find((c) => c.id === currentConnectionId && c.status === ConnectionStatus.CONNECTED)
    if (activeBinding || selectedConn) {
      const conn = activeBinding ? connections.find((c) => c.id === activeBinding.connectionId) : selectedConn!
      if (conn) {
        const serverContext = `当前服务器：${conn.name} (${conn.username}@${conn.host}:${conn.port})`
        messageContent = `${serverContext}\n\n${messageContent}`
      }
    }

    const userMessage: AgentMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputText, // 显示原始输入
      timestamp: Date.now(),
    }
    addMessage(sessionId, userMessage)
    setInputText('')
    setLoading(true)

    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = '120px'
      inputHeightRef.current = 120
    }

    // 流式响应
    let assistantId = `msg_${Date.now() + 1}`
    const assistantMessage: AgentMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      steps: [],
    }
    addMessage(sessionId, assistantMessage)

    let fullContent = ''
    const steps: ReActStep[] = []

    const abort = agentApi.reactChatStream(
      currentAgentId,
      'default',
      sessionId,
      messageContent,
      (step: ReActStep) => {
        steps.push(step)
        updateMessageSteps(sessionId, assistantId, steps)
      },
      (fullText: string) => {
        fullContent = fullText
        updateMessage(sessionId, assistantId, fullContent)
      },
      (finalContent: string) => {
        if (finalContent) {
          fullContent = finalContent
          updateMessage(sessionId, assistantId, fullContent)
        }
        setLoading(false)
      },
      (err: string) => {
        console.error('[reactChatStream] error:', err)
        updateMessage(sessionId, assistantId, `请求失败: ${err}`)
        setLoading(false)
      },
      activeTerminalSessionId || undefined
    )

    void abort
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isModifier = e.metaKey || e.ctrlKey
    // 发送时机：(1) Enter 且无修饰键 且发送模式=Enter  (2) Enter+修饰键 且发送模式=Cmd
    const shouldSend =
      (e.key === 'Enter' && !e.shiftKey && sendOnEnter && !isModifier) ||
      (e.key === 'Enter' && isModifier && !sendOnEnter)
    if (shouldSend) {
      e.preventDefault()
      handleSend()
      return
    }
    // Shift+Enter 始终换行
    if (e.key === 'Enter' && e.shiftKey) {
      // 默认行为，textarea 会换行
      return
    }
    // 非发送键：Shift+Enter 以外的 Enter 不发送
    if (e.key === 'Enter' && !e.shiftKey && !isModifier) {
      e.preventDefault()
    }
  }

  const toggleSendMode = () => {
    const next = !sendOnEnter
    setSendOnEnter(next)
    localStorage.setItem('sendOnEnter', String(next))
  }

  const selectSendMode = (mode: 'enter' | 'cmd') => {
    const next = mode === 'enter'
    setSendOnEnter(next)
    localStorage.setItem('sendOnEnter', String(next))
    setShowSendModeDropdown(false)
  }

  const canSend = inputText.trim() && currentAgentId && !isLoading

  return (
    <div
      className="flex flex-col h-full flex-shrink-0 overflow-hidden"
      style={{ width, backgroundColor: colors.bgPrimary }}
    >
      {/* 服务器状态指示条 —— 直接跟随左侧选中，切换由左侧面板控制 */}
      {(() => {
        // 优先用 activeBinding（已绑定终端会话），其次用左侧选中的连接
        const conn = activeBinding
          ? connections.find((c) => c.id === activeBinding.connectionId)
          : connections.find((c) => c.id === currentConnectionId)
        if (!conn) return null
        const connected = conn.status === 1
        return (
          <div
            className="flex items-center gap-2 px-4 py-1.5 border-b"
            style={{
              backgroundColor: connected ? `${colors.accent}08` : `${colors.textDim}06`,
              borderColor: colors.border,
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: connected ? '#22c55e' : colors.textDim }}
            />
            <span className="text-[11px] truncate" style={{ color: colors.textDim }}>
              {conn.name}（{conn.username}@{conn.host}）{connected ? '' : ' · 未连接'}
            </span>
          </div>
        )
      })()}

      {/* ===== 消息区 ===== */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!currentSession ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <img src="/logo.png" alt="WaLiSSH" className="w-14 h-14 mb-2 opacity-60 rounded" />
            <h3 className="text-base font-medium" style={{ color: colors.text }}>开始对话</h3>
            <p className="text-xs text-center max-w-xs leading-relaxed" style={{ color: colors.textSecondary }}>
              连接 SSH 后，可以向我询问服务器状态、执行命令、排查问题、管理文件。
            </p>
          </div>
        ) : currentSession.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <img src="/logo.png" alt="WaLiSSH" className="w-10 h-10 opacity-50 rounded" />
            <div className="text-center">
              <p className="text-sm font-medium mb-1" style={{ color: colors.text }}>WaLiSSH AI</p>
              <p className="text-xs" style={{ color: colors.textDim }}>执行命令 · 排查问题 · 管理服务器</p>
            </div>
            <div className="w-full max-w-xs space-y-1.5">
              {['检查服务器状态', '分析日志文件', '部署应用', '排查报错'].map((text) => (
                <button
                  key={text}
                  onClick={() => setInputText(text)}
                  className="w-full text-left px-3 py-2 rounded-md text-xs transition-colors"
                  style={{
                    color: colors.textSecondary,
                    backgroundColor: colors.bgTertiary,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-3">
            {currentSession.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="px-4 py-2 flex justify-start">
                <div
                  className="px-3.5 py-2.5 flex items-center gap-2"
                  style={{ backgroundColor: colors.bgTertiary, borderRadius: '12px 12px 12px 2px' }}
                >
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: colors.accent,
                          animation: `pulse-dot 1.4s ${delay}ms infinite ease-in-out both`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px]" style={{ color: colors.textDim }}>思考中...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ===== 终端选中提示 ===== */}
      {showAddToChatHint && terminalSelection && (
        <div
          className="mx-4 mb-2 px-3 py-2 rounded-lg text-[11px] flex items-center justify-between"
          style={{
            backgroundColor: colors.bgTertiary,
            border: `1px dashed ${colors.accent}60`,
            color: colors.textSecondary,
          }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span className="truncate max-w-[200px]">
              已选中 {terminalSelection.text.length} 个字符
            </span>
          </div>
          <button
            onClick={clearTerminalSelection}
            className="p-1 rounded hover:bg-black/10"
            style={{ color: colors.textDim }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}

      {/* ===== 拖拽手柄 ===== */}
      <div
        className="w-full h-3 cursor-ns-resize select-none flex items-center justify-center transition-colors hover:bg-blue-500/20 flex-shrink-0"
        title="拖拽调整输入框高度"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const startY = e.clientY
          const startHeight = textareaRef.current?.offsetHeight || 120

          const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = startY - moveEvent.clientY
            const newHeight = Math.max(80, Math.min(280, startHeight + deltaY))
            if (textareaRef.current) {
              textareaRef.current.style.height = newHeight + 'px'
              inputHeightRef.current = newHeight
            }
          }

          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
          }

          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)
        }}
      >
        <div className="flex gap-1 opacity-30">
          <div className="w-1 h-1 rounded-full bg-gray-400" />
          <div className="w-1 h-1 rounded-full bg-gray-400" />
        </div>
      </div>

      {/* ===== 菜单栏 ===== */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t flex-shrink-0"
        style={{
          backgroundColor: colors.bgSecondary,
          borderColor: colors.border,
        }}
      >
        {/* 左侧：拆解（移除了手动添加服务器按钮） */}
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              backgroundColor: colors.bgTertiary,
              color: colors.textSecondary,
              border: '1px solid transparent',
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            拆解
          </button>
        </div>

        {/* 右侧：新建 + 历史 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => currentAgentId && newConversation(currentAgentId)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              backgroundColor: colors.bgTertiary,
              color: colors.textSecondary,
              border: '1px solid transparent',
            }}
            title="新建会话"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all"
            style={{
              backgroundColor: colors.bgTertiary,
              color: colors.textSecondary,
              border: '1px solid transparent',
            }}
            title="历史记录"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
        </div>
      </div>

      {/* ===== 输入区 ===== */}
      <div
        className="flex flex-col relative px-4 pt-2 pb-3 flex-shrink-0"
        style={{ backgroundColor: colors.bgSecondary }}
      >
        {/* 输入框容器 */}
        <div
          className={`relative w-full rounded-lg border transition-all`}
          style={{
            backgroundColor: colors.bgInput,
            borderColor: isFocused ? `${colors.accent}80` : colors.border,
            boxShadow: isFocused ? `0 0 0 1px ${colors.accent}30` : 'none',
          }}
        >
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isLoading}
            rows={4}
            className="w-full bg-transparent resize-none outline-none text-[13px] leading-relaxed"
            style={{
              color: isLoading ? colors.textDim : colors.text,
              minHeight: 120,
              maxHeight: 280,
              padding: '8px 16px 44px 16px',
            }}
          />

          {/* Placeholder overlay */}
          {!inputText && !isFocused && (
            <div
              className="absolute pointer-events-none text-sm"
              style={{ left: '16px', top: '8px', color: colors.textDim, opacity: 0.6 }}
            >
              {inputPlaceholder()}
            </div>
          )}

          {/* 右下角按钮组 */}
          <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
            {/* 附件 */}
            <button
              className="p-1.5 rounded-md transition-colors"
              style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
              title="附件"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            {/* 图片 */}
            <button
              className="p-1.5 rounded-md transition-colors"
              style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary }}
              title="上传图片"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
            {/* 发送/停止 */}
            {isLoading ? (
              <button
                onClick={() => {/* 取消功能待实现 */}}
                className="p-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: colors.red,
                  color: '#fff',
                }}
                title="停止"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="p-1.5 rounded-md transition-colors"
                style={{
                  backgroundColor: canSend ? colors.accent : colors.bgTertiary,
                  color: canSend ? '#fff' : colors.textSecondary,
                  opacity: canSend ? 1 : 0.5,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                }}
                title="发送"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 底部状态栏：模型选择 + 发送模式 */}
        <div className="flex items-center mt-2 text-[11px]" style={{ color: colors.textDim }}>
          {/* 左侧：智能体选择器 */}
          <div className="relative" style={{ zIndex: 10 }}>
            <select
              value={currentAgentId || ''}
              onChange={(e) => setCurrentAgentId(e.target.value)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors appearance-none pr-6"
              style={{
                backgroundColor: colors.bgTertiary,
                color: colors.textSecondary,
                fontSize: '11px',
                border: 'none',
              }}
            >
              {agents.length === 0 && <option value="">加载中...</option>}
              {agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.agentName}
                </option>
              ))}
            </select>
            {/* 下拉箭头 */}
            <svg
              className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ width: 12, height: 12, color: colors.textSecondary, opacity: 0.6 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          {/* 中间留白 */}
          <div className="flex-1" />

          {/* 右侧：发送模式切换 */}
          <div className="relative">
            <button
              onClick={() => setShowSendModeDropdown(!showSendModeDropdown)}
              className="flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors hover:bg-black/10"
              style={{ backgroundColor: 'transparent', color: colors.textDim }}
              title="点击选择发送快捷键"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              {sendOnEnter ? (
                <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>Enter 发送</span>
              ) : (
                <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{currentKeyLabel} 发送</span>
              )}
            </button>
            {showSendModeDropdown && (
              <div
                className="absolute bottom-full right-0 mb-1 rounded-lg border shadow-lg py-1 min-w-[140px]"
                style={{
                  backgroundColor: colors.bgPrimary,
                  borderColor: colors.border,
                }}
              >
                <button
                  onClick={() => selectSendMode('enter')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                  style={{ fontSize: '11px', color: sendOnEnter ? colors.accent : colors.textSecondary }}
                >
                  {sendOnEnter && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                  <span>Enter 发送</span>
                </button>
                <button
                  onClick={() => selectSendMode('cmd')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                  style={{ fontSize: '11px', color: !sendOnEnter ? colors.accent : colors.textSecondary }}
                >
                  {!sendOnEnter && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                  <span>{currentKeyLabel} 发送</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 连接选择器弹窗已移除（改为自动绑定） */}
    </div>
  )
}
