import { useThemeStore } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useAuthStore } from '../stores/authStore'

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarVisible: boolean
  onToggleTerminal: () => void
  terminalVisible: boolean
  onToggleChat: () => void
  chatVisible: boolean
  onOpenSSHModal: () => void
}

export function Header({
  onToggleSidebar,
  sidebarVisible,
  onToggleTerminal,
  terminalVisible,
  onToggleChat,
  chatVisible,
  onOpenSSHModal,
}: HeaderProps) {
  const { colors } = useThemeStore()
  const { connections, currentConnectionId } = useConnectionStore()
  const { username, logout } = useAuthStore()
  const currentConn = connections.find(c => c.id === currentConnectionId)

  return (
    <div
      className="h-14 flex items-center gap-3 px-4 flex-shrink-0"
      style={{
        backgroundColor: colors.bgTitleBar,
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
      }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150"
          style={{ backgroundColor: 'transparent', color: colors.textSecondary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.accent}18`
            e.currentTarget.style.color = colors.accent
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = colors.textSecondary
          }}
          title={sidebarVisible ? '隐藏侧边栏' : '显示侧边栏'}
        >
          <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {sidebarVisible ? (
              <path d="M11 17l-4-4 4-4M18 13h-9" />
            ) : (
              <path d="M13 7l4 4-4 4M6 13h9" />
            )}
          </svg>
        </button>

        <button
          onClick={onOpenSSHModal}
          className="flex items-center gap-2 h-9 pl-3 pr-3.5 rounded-xl transition-all duration-150 border"
          style={{ backgroundColor: 'transparent', color: colors.textSecondary, borderColor: colors.border }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${colors.accent}18`
            e.currentTarget.style.color = colors.accent
            e.currentTarget.style.borderColor = `${colors.accent}55`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = colors.textSecondary
            e.currentTarget.style.borderColor = colors.border
          }}
          title="添加 SSH 连接"
        >
          <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-[13px] font-medium leading-none">添加连接</span>
        </button>

        {currentConn && (
          <div
            className="hidden xl:flex items-center gap-3 px-3 py-2 rounded-xl border"
            style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: colors.green, boxShadow: `0 0 0 4px ${colors.green}18` }}
            />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-none truncate" style={{ color: colors.text }}>
                {currentConn.name}
              </div>
              <div className="text-[12px] font-mono mt-1 truncate" style={{ color: colors.textDim }}>
                {currentConn.username}@{currentConn.host}:{currentConn.port}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTerminal}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-colors border"
          style={{
            backgroundColor: terminalVisible ? colors.accent : 'transparent',
            color: terminalVisible ? '#fff' : colors.textSecondary,
            borderColor: terminalVisible ? colors.accent : colors.border,
          }}
          title="显示或隐藏终端"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span>终端</span>
        </button>

        <button
          onClick={onToggleChat}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-colors border"
          style={{
            backgroundColor: chatVisible ? `${colors.accent}18` : 'transparent',
            color: chatVisible ? colors.accent : colors.textSecondary,
            borderColor: chatVisible ? `${colors.accent}35` : colors.border,
          }}
          title="显示或隐藏 AI 面板"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>对话agent</span>
        </button>

        <div className="w-px h-5 mx-1" style={{ backgroundColor: colors.border }} />

        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ backgroundColor: colors.bgSecondary }}
        >
          <span className="text-[12px] font-medium" style={{ color: colors.textDim }}>{username}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors hover:bg-black/5"
            style={{ color: colors.textSecondary }}
            title="退出登录"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            退出
          </button>
        </div>
      </div>
    </div>
  )
}
