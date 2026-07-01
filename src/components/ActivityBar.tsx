import { useThemeStore } from '../stores/themeStore'

type TabId = 'servers' | 'files' | 'sftp' | 'git' | 'extensions'

interface ActivityBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onOpenSettings: () => void
}

const tabs: { id: TabId; icon: React.ReactElement; label: string }[] = [
  {
    id: 'servers',
    label: 'SSH 服务器',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'files',
    label: '文件目录',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'sftp',
    label: 'SFTP',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        <polyline points="13 15 15 17 17 15" />
      </svg>
    ),
  },
  {
    id: 'git',
    label: 'Git 分支管理',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
  },
  {
    id: 'extensions',
    label: 'MCPs & Skills',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
]

export function ActivityBar({ activeTab, onTabChange, onOpenSettings }: ActivityBarProps) {
  const { colors } = useThemeStore()

  return (
    <div
      className="w-16 flex flex-col items-center py-3 gap-3 flex-shrink-0"
      style={{ backgroundColor: colors.bgTertiary, borderRight: `1px solid ${colors.border}` }}
    >
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center text-[12px] font-semibold tracking-wide"
        style={{ backgroundColor: colors.bgSecondary, color: colors.accent, border: `1px solid ${colors.border}` }}
        title="StackSSH"
      >
        SS
      </div>

      <div className="flex flex-col gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="w-11 h-11 flex items-center justify-center transition-colors relative rounded-2xl border"
              style={{
                color: active ? colors.text : colors.textSecondary,
                backgroundColor: active ? colors.accentSoft : 'transparent',
                borderColor: active ? `${colors.accent}35` : 'transparent',
                boxShadow: active ? `inset 0 0 0 1px ${colors.accent}18` : 'none',
              }}
              title={tab.label}
            >
              {active && (
                <span
                  className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-full"
                  style={{ backgroundColor: colors.accent }}
                />
              )}
              {tab.icon}
            </button>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          onClick={onOpenSettings}
          className="w-11 h-11 flex items-center justify-center transition-colors rounded-2xl border"
          style={{ color: colors.textDim, borderColor: 'transparent' }}
          title="设置"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
