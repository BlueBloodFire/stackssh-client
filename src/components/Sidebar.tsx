import { useConnectionStore } from '../stores/connectionStore'
import { useAgentStore } from '../stores/agentStore'

export function Sidebar() {
  const { connections, currentConnectionId, selectConnection, serverStatus } = useConnectionStore()
  const { sessions, currentSessionId, setCurrentSession, createSession } = useAgentStore()

  const sessionList = Array.from(sessions.values())

  return (
    <div className="w-56 bg-[#252526] border-r border-[#3c3c3c] flex flex-col h-full">
      {/* 服务端状态 */}
      <div className="p-3 border-b border-[#3c3c3c]">
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${serverStatus.connected ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className="text-[#cccccc]">
            {serverStatus.connected ? '已连接' : '未连接'}
          </span>
        </div>
        <div className="text-xs text-[#6a6a6a] mt-1 truncate">
          {serverStatus.url}
        </div>
      </div>

      {/* SSH 连接 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="text-xs text-[#6a6a6a] uppercase tracking-wider mb-2">
            SSH 连接
          </div>
          {connections.length === 0 ? (
            <div className="text-xs text-[#6a6a6a]">暂无连接</div>
          ) : (
            connections.map((conn) => (
              <div
                key={conn.id}
                onClick={() => selectConnection(conn.id)}
                className={`px-2 py-1.5 rounded cursor-pointer mb-1 text-sm ${
                  currentConnectionId === conn.id
                    ? 'bg-[#094771] text-white'
                    : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                }`}
              >
                <div className="truncate">{conn.name}</div>
                <div className="text-xs text-[#6a6a6a] truncate">
                  {conn.username}@{conn.host}:{conn.port}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Agent 会话 */}
        <div className="p-3 border-t border-[#3c3c3c]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#6a6a6a] uppercase tracking-wider">
              AI 会话
            </span>
            <button
              onClick={() => createSession()}
              className="text-xs text-[#4ec9b0] hover:text-[#4ec9b0]/80"
            >
              + 新建
            </button>
          </div>
          {sessionList.length === 0 ? (
            <div className="text-xs text-[#6a6a6a]">暂无会话</div>
          ) : (
            sessionList.map((session) => (
              <div
                key={session.id}
                onClick={() => setCurrentSession(session.id)}
                className={`px-2 py-1.5 rounded cursor-pointer mb-1 text-sm ${
                  currentSessionId === session.id
                    ? 'bg-[#094771] text-white'
                    : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                }`}
              >
                {session.name}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部设置入口 */}
      <div className="p-3 border-t border-[#3c3c3c]">
        <button className="w-full px-2 py-1.5 text-sm text-[#cccccc] hover:bg-[#2a2d2e] rounded text-left">
          ⚙️ 设置
        </button>
      </div>
    </div>
  )
}
