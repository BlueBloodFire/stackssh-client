import { useRef, useEffect, useState } from 'react'
import { useThemeStore } from '../stores/themeStore'
import { useAgentStore } from '../stores/agentStore'
import type { AgentMessage } from '../types'

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

// ===== 右侧 AI 面板 =====
interface RightSidebarProps {
  width?: number
}

export function RightSidebar({ width = 400 }: RightSidebarProps) {
  const { colors } = useThemeStore()
  const { sessions, currentSessionId, inputText, setInputText, addMessage, isLoading, setLoading, createSession } = useAgentStore()

  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const inputHeightRef = useRef<number>(120)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages, isLoading])

  // 自动调整输入框高度（只增不减）
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

  const handleSend = async () => {
    if (!inputText.trim() || !currentSessionId || isLoading) return
    const userMessage: AgentMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputText,
      timestamp: Date.now(),
    }
    addMessage(currentSessionId, userMessage)
    setInputText('')
    setLoading(true)

    // 重置高度
    if (textareaRef.current) {
      textareaRef.current.style.height = '120px'
      inputHeightRef.current = 120
    }

    setTimeout(() => {
      const assistantMessage: AgentMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `已收到: ${userMessage.content}\n\n这是模拟响应。`,
        timestamp: Date.now(),
      }
      if (currentSessionId) addMessage(currentSessionId, assistantMessage)
      setLoading(false)
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter 发送，Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = inputText.trim() && currentSession && !isLoading

  return (
    <div
      className="flex flex-col h-full flex-shrink-0"
      style={{ width, backgroundColor: colors.bgPrimary }}
    >
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

      {/* ===== 拖拽手柄（调整输入框高度）===== */}
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
        {/* 左侧：技能 */}
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
          技能
        </button>

        {/* 右侧：新建 + 历史 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => createSession()}
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
            placeholder="向 WaLiSSH 提问... (@ 技能 · ↑↓ 历史 · Enter 发送)"
            rows={4}
            className="w-full bg-transparent resize-none outline-none text-[13px] leading-relaxed"
            style={{
              color: colors.text,
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
              style={{ backgroundColor: '#3c3c3c', color: colors.textSecondary }}
              title="附件"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
            {/* 图片 */}
            <button
              className="p-1.5 rounded-md transition-colors"
              style={{ backgroundColor: '#3c3c3c', color: colors.textSecondary }}
              title="上传图片"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </button>
            {/* 发送/停止 */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-1.5 rounded-md transition-colors"
              style={{
                backgroundColor: canSend ? colors.accent : '#3c3c3c',
                color: canSend ? '#fff' : colors.textSecondary,
                opacity: canSend ? 1 : 0.5,
              }}
              title="发送"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>

        {/* 底部状态栏：模型选择 + 发送模式 */}
        <div className="flex items-center mt-2 text-[11px]" style={{ color: colors.textDim }}>
          {/* 左侧：模型选择器 */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors hover:bg-white/5" style={{ backgroundColor: '#3c3c3c' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.green }} />
            <span className="font-medium truncate max-w-[100px]" style={{ color: colors.textSecondary }}>gpt-4.1</span>
            <svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          {/* 中间留白 */}
          <div className="flex-1" />

          {/* 右侧：发送模式提示 */}
          <span>Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>
    </div>
  )
}
