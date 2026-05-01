import { useThemeStore } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarVisible: boolean
  onToggleTerminal: () => void
  terminalVisible: boolean
  onToggleChat: () => void
  chatVisible: boolean
}

export function Header({ onToggleSidebar, sidebarVisible, onToggleTerminal, terminalVisible, onToggleChat, chatVisible }: HeaderProps) {
  const { colors } = useThemeStore()
  const { connections, currentConnectionId } = useConnectionStore()
  const currentConn = connections.find(c => c.id === currentConnectionId)

  return (
    <div
      className="h-12 flex items-center px-4 flex-shrink-0"
      style={{ backgroundColor: colors.bgTitleBar, borderBottom: `1px solid ${colors.border}` }}
    >
      {/* 左侧：折叠 + 连接信息 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200"
          style={{ color: colors.textSecondary, backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.textSecondary}15`}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title="切换侧边栏 (⌘B)"
        >
          <div className="flex items-center justify-center">
            <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {sidebarVisible ? (
                <path d="M11 17l-4-4 4-4M18 13h-9" />
              ) : (
                <path d="M13 7l4 4-4 4M6 13h9" />
              )}
            </svg>
          </div>
        </button>

        {currentConn ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.green }} />
            <span className="text-sm font-medium" style={{ color: colors.text }}>{currentConn.name}</span>
            <span className="text-xs font-mono" style={{ color: colors.textDim }}>
              {currentConn.username}@{currentConn.host}:{currentConn.port}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="WaLiSSH" className="w-5 h-5 object-contain rounded" />
            <span className="font-semibold text-sm" style={{ color: colors.text }}>WaLiSSH</span>
          </div>
        )}
      </div>

      {/* 中间：留白 */}
      <div className="flex-1" />

      {/* 右侧：终端 + AI 对话 切换 */}
      <div className="flex items-center gap-2">
        {/* 终端切换 */}
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            terminalVisible
              ? 'text-white'
              : ''
          }`}
          style={{
            backgroundColor: terminalVisible ? colors.accent : 'transparent',
            color: terminalVisible ? '#fff' : colors.textSecondary,
          }}
          title="显示/隐藏终端 (⌘`)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span>终端</span>
        </button>

        {/* AI 对话切换 */}
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            chatVisible
              ? ''
              : ''
          }`}
          style={{
            backgroundColor: chatVisible ? `${colors.accent}20` : 'transparent',
            color: chatVisible ? colors.accent : colors.textSecondary,
          }}
          title="显示/隐藏 AI 助手"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>AI 助手</span>
        </button>
      </div>
    </div>
  )
}
