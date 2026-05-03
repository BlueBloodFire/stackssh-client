import { useRef, useEffect, useState, useCallback } from 'react'
import { useThemeStore } from '../stores/themeStore'
import { useAgentStore } from '../stores/agentStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSshAgentStore } from '../stores/sshAgentStore'
import * as agentApi from '../api/agent'
import * as terminalApi from '../api/terminal'
import type { AgentMessage } from '../types'
import { ConnectionStatus } from '../types'

// ===== 消息气泡 =====
function MessageBubble({ message }: { message: AgentMessage }) {
  const { colors } = useThemeStore()
  const isUser = message.role === 'user'

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

function formatMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre style="margin:6px 0;padding:10px;border-radius:6px;overflow-x:auto;font-size:11px;font-family:'JetBrains Mono',monospace;background:#0d1117;color:#c9d1d9;border:1px solid #30363d"><code>${code.trim()}</code></pre>`
  })
  html = html.replace(/`([^`]+)`/g, '<code style="padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace;background:#1e1e1e40;color:#79c0ff">$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\n/g, '<br/>')
  return html
}

// ===== 服务器信息标签 =====
function ServerTag({
  name,
  host,
  onRemove,
}: {
  name: string
  host: string
  onRemove?: () => void
}) {
  const { colors } = useThemeStore()

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
      style={{
        backgroundColor: `${colors.accent}20`,
        color: colors.accent,
        border: `1px solid ${colors.accent}40`,
      }}
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
        <line x1="6" y1="6" x2="6.01" y2="6"></line>
        <line x1="6" y1="18" x2="6.01" y2="18"></line>
      </svg>
      <span className="truncate max-w-[120px]">{name}</span>
      <span style={{ color: colors.textDim }}>({host})</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 p-0.5 rounded hover:bg-black/10"
          style={{ color: colors.textDim }}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  )
}

// ===== 连接选择器弹窗 =====
function ConnectionSelectorModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean
  onClose: () => void
  onSelect: (connectionId: string, connectionName: string, host: string, port: number, username: string) => void
}) {
  const { colors } = useThemeStore()
  const { connections } = useConnectionStore()
  const connectedConns = connections.filter((c) => c.status === ConnectionStatus.CONNECTED)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-[320px] rounded-lg overflow-hidden"
        style={{ backgroundColor: colors.bgPrimary }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: colors.border }}
        >
          <span className="text-sm font-medium" style={{ color: colors.text }}>
            选择服务器
          </span>
          <button onClick={onClose} style={{ color: colors.textDim }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-2">
          {connectedConns.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs" style={{ color: colors.textDim }}>
              暂无已连接的 SSH 服务器
              <br />
              请先连接服务器后再添加
            </div>
          ) : (
            connectedConns.map((conn) => (
              <button
                key={conn.id}
                className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors"
                onClick={() => {
                  onSelect(conn.id, conn.name, conn.host, conn.port, conn.username)
                  onClose()
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#22c55e' }}
                  />
                  <span className="text-sm" style={{ color: colors.text }}>
                    {conn.name}
                  </span>
                </div>
                <div className="text-[11px] mt-0.5 ml-4" style={{ color: colors.textDim }}>
                  {conn.username}@{conn.host}:{conn.port}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ===== 右侧 AI 面板 V2 =====
interface RightSidebarV2Props {
  width?: number
  /** 当前激活的终端会话 ID */
  activeTerminalSessionId?: string | null
}

export function RightSidebarV2({ width = 400, activeTerminalSessionId }: RightSidebarV2Props) {
  const { colors } = useThemeStore()
  const {
    sessions,
    currentSessionId,
    inputText,
    setInputText,
    addMessage,
    updateMessage,
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
    isBinding,
    bindingError,
    showConnectionSelector,
    terminalSelection,
    showAddToChatHint,
    bindTerminal,
    unbindTerminal,
    setActiveBinding,
    openConnectionSelector,
    closeConnectionSelector,
    setTerminalSelection,
    clearTerminalSelection,
    formatServerContext,
  } = useSshAgentStore()

  // 启动时加载智能体列表
  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const inputHeightRef = useRef<number>(120)

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

  // ===== 自动绑定当前 SSH 连接 =====
  useEffect(() => {
    const autoBindCurrentConnection = async () => {
      // 条件检查
      if (!currentSessionId) return
      if (!currentConnectionId) return
      if (!activeTerminalSessionId) return
      if (activeBinding?.terminalSessionId === activeTerminalSessionId) return

      const connection = connections.find((c) => c.id === currentConnectionId)
      if (!connection || connection.status !== ConnectionStatus.CONNECTED) return

      // 执行绑定
      const success = await bindTerminal(
        currentSessionId,
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
        console.log('[RightSidebarV2] Auto-bound to:', connection.name)
      }
    }

    autoBindCurrentConnection()
  }, [
    currentSessionId,
    currentConnectionId,
    activeTerminalSessionId,
    activeBinding,
    connections,
    bindTerminal,
  ])

  // ===== 处理添加服务器到对话 =====
  const handleAddServer = useCallback(
    async (connectionId: string, connectionName: string, host: string, port: number, username: string) => {
      if (!currentSessionId) {
        // 没有会话，先创建
        if (!currentAgentId) return
        await createServerSession(currentAgentId)
      }

      const sessionId = currentSessionId!

      // 检查是否已连接
      const connection = connections.find((c) => c.id === connectionId)
      if (!connection || connection.status !== ConnectionStatus.CONNECTED) {
        alert('请先连接该服务器')
        return
      }

      // 需要获取终端会话 ID
      if (!activeTerminalSessionId) {
        alert('请先打开终端')
        return
      }

      // 绑定
      const success = await bindTerminal(sessionId, activeTerminalSessionId, {
        connectionId,
        connectionName,
        host,
        port,
        username,
      })

      if (success) {
        // 添加系统消息
        const systemMessage: AgentMessage = {
          id: `msg_${Date.now()}`,
          role: 'system',
          content: `已关联服务器：${connectionName} (${username}@${host}:${port})`,
          timestamp: Date.now(),
        }
        addMessage(sessionId, systemMessage)
      }
    },
    [
      currentSessionId,
      currentAgentId,
      connections,
      activeTerminalSessionId,
      bindTerminal,
      createServerSession,
      addMessage,
    ]
  )

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

    // 如果有绑定的服务器，添加上下文
    if (activeBinding) {
      const serverContext = formatServerContext(activeBinding)
      messageContent = `${serverContext}\n\n${messageContent}`
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
    }
    addMessage(sessionId, assistantMessage)

    let fullContent = ''

    const abort = agentApi.chatStream(
      currentAgentId,
      'default',
      sessionId,
      messageContent, // 发送带上下文的消息
      (chunk: string) => {
        fullContent += chunk
        updateMessage(sessionId, assistantId, fullContent)
      },
      () => {
        setLoading(false)
      },
      (err: string) => {
        console.error('[chatStream] error:', err)
        updateMessage(sessionId, assistantId, `请求失败: ${err}`)
        setLoading(false)
      },
      activeTerminalSessionId // 传递终端会话ID
    )

    void abort
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = inputText.trim() && currentAgentId && !isLoading

  return (
    <div
      className="flex flex-col h-full flex-shrink-0"
      style={{ width, backgroundColor: colors.bgPrimary }}
    >
      {/* ===== 绑定状态栏 ===== */}
      {activeBinding && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{
            backgroundColor: `${colors.accent}10`,
            borderColor: `${colors.accent}30`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#22c55e', animation: 'pulse 2s infinite' }}
            />
            <span className="text-[11px]" style={{ color: colors.textSecondary }}>
              已关联：{activeBinding.connectionName}
            </span>
          </div>
          <button
            onClick={() => currentSessionId && unbindTerminal(currentSessionId)}
            className="text-[11px] px-2 py-0.5 rounded hover:bg-black/10"
            style={{ color: colors.textDim }}
          >
            解除
          </button>
        </div>
      )}

      {/* ===== 消息区 ===== */}
      <div className="flex-1 overflow-y-auto">
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
        {/* 左侧：拆解 + 添加服务器 */}
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

          {/* 添加服务器按钮 */}
          <button
            onClick={openConnectionSelector}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-black/5"
            style={{
              backgroundColor: activeBinding ? `${colors.accent}20` : colors.bgTertiary,
              color: activeBinding ? colors.accent : colors.textSecondary,
              border: activeBinding ? `1px solid ${colors.accent}40` : '1px solid transparent',
            }}
            title="添加服务器到对话"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            {activeBinding ? '已关联' : '+ 服务器'}
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
              向 WaLiSSH 提问... (@ 技能 · ↑↓ 历史 · Enter 发送)
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

          {/* 右侧：发送模式提示 */}
          <span>Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>

      {/* ===== 连接选择器弹窗 ===== */}
      <ConnectionSelectorModal
        isOpen={showConnectionSelector}
        onClose={closeConnectionSelector}
        onSelect={handleAddServer}
      />
    </div>
  )
}
