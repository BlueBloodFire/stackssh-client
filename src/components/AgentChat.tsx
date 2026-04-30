import { useAgentStore } from '../stores/agentStore'
import { useConnectionStore } from '../stores/connectionStore'
import type { AgentMessage } from '../types'

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="text-xs text-[#6a6a6a] italic px-4 py-2">
        {message.content}
      </div>
    )
  }

  return (
    <div className={`px-4 py-2 ${isUser ? 'bg-[#094771]' : 'bg-transparent'}`}>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded bg-[#4ec9b0] flex items-center justify-center text-xs text-black flex-shrink-0">
          {isUser ? '👤' : '🤖'}
        </div>
        <div className="flex-1">
          <div className="text-xs text-[#6a6a6a] mb-1">
            {isUser ? '你' : 'Agent'}
          </div>
          <div className="text-sm text-[#d4d4d4] whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AgentChat() {
  const { sessions, currentSessionId, inputText, setInputText, addMessage, isLoading, setLoading } = useAgentStore()
  const { serverStatus } = useConnectionStore()

  const currentSession = currentSessionId ? sessions.get(currentSessionId) : null

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

    // TODO: 调用后端 AI Agent API
    // 暂时模拟响应
    setTimeout(() => {
      const assistantMessage: AgentMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `已收到: ${userMessage.content}\n\n这是 WaLiSSH AI Agent 的模拟响应。实际响应将来自后端服务 (${serverStatus.url})`,
        timestamp: Date.now(),
      }
      if (currentSessionId) {
        addMessage(currentSessionId, assistantMessage)
      }
      setLoading(false)
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e]">
      {/* 聊天标题栏 */}
      <div className="h-9 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-4">
        <span className="text-sm text-[#cccccc]">AI Agent</span>
        {!serverStatus.connected && (
          <span className="ml-2 text-xs text-yellow-500">
            (服务端未连接)
          </span>
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {!currentSession ? (
          <div className="flex items-center justify-center h-full text-[#6a6a6a] text-sm">
            选择或创建一个会话开始对话
          </div>
        ) : (
          <>
            {currentSession.messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-[#6a6a6a] text-sm">
                开始和 AI Agent 对话吧
              </div>
            )}
            {currentSession.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 text-[#6a6a6a] text-sm">
                  <div className="w-4 h-4 border-2 border-[#6a6a6a] border-t-transparent rounded-full animate-spin" />
                  AI 思考中...
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 输入框 */}
      <div className="p-3 border-t border-[#3c3c3c] bg-[#252526]">
        <div className="flex gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送)"
            className="flex-1 bg-[#3c3c3c] text-[#d4d4d4] text-sm rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#007acc] min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || !currentSession || isLoading}
            className="px-4 py-2 bg-[#0e639c] text-white text-sm rounded hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
