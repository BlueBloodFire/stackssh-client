import { useState } from 'react'
import { useThemeStore } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'

type TabId = 'servers' | 'files' | 'sftp' | 'extensions'

interface LeftSidebarProps {
  activeTab: TabId
  onOpenSettings: () => void
}

// 模拟文件树数据
const mockFileTree = [
  {
    name: '/',
    type: 'dir',
    expanded: true,
    children: [
      { name: 'home', type: 'dir', expanded: false, children: [] },
      { name: 'etc', type: 'dir', expanded: false, children: [] },
      { name: 'var', type: 'dir', expanded: false, children: [] },
      { name: 'usr', type: 'dir', expanded: true, children: [
        { name: 'bin', type: 'dir', children: [] },
        { name: 'local', type: 'dir', children: [] },
      ]},
      { name: 'tmp', type: 'dir', expanded: false, children: [] },
      { name: 'boot', type: 'dir', expanded: false, children: [] },
      { name: 'root', type: 'dir', expanded: false, children: [] },
      { name: 'opt', type: 'dir', expanded: false, children: [] },
    ]
  }
]

export function LeftSidebar({ activeTab }: LeftSidebarProps) {
  const { colors } = useThemeStore()
  const { connections, currentConnectionId, selectConnection } = useConnectionStore()
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['/']))

  const currentConn = connections.find((c) => c.id === currentConnectionId)

  const toggleDir = (path: string) => {
    const next = new Set(expandedDirs)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setExpandedDirs(next)
  }

  const renderTree = (nodes: any[], depth = 0, parentPath = '') => {
    return nodes.map((node) => {
      const path = parentPath ? `${parentPath}/${node.name}` : node.name
      const isExpanded = expandedDirs.has(path)
      const hasChildren = node.children && node.children.length > 0

      return (
        <div key={path}>
          <button
            onClick={() => hasChildren && toggleDir(path)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-white/5 transition-colors"
            style={{ paddingLeft: `${8 + depth * 16}px`, color: colors.textSecondary }}
          >
            {hasChildren ? (
              <span className="text-[10px] w-3 flex items-center justify-center" style={{ color: colors.textDim }}>
                <svg className="w-3 h-3 transition-transform" style={{ transform: isExpanded ? '' : 'rotate(-90deg)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            ) : (
              <span className="w-3" />
            )}
            <svg className="w-4 h-4 shrink-0" style={{ color: node.type === 'dir' ? colors.accent : colors.textDim }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {node.type === 'dir' ? (
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              ) : (
                <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline></>
              )}
            </svg>
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && node.children && renderTree(node.children, depth + 1, path)}
        </div>
      )
    })
  }

  // 标题映射
  const tabLabels: Record<TabId, string> = {
    servers: 'SSH 服务器',
    files: '文件目录',
    sftp: 'SFTP 文件传输',
    extensions: '扩展',
  }

  return (
    <div
      className="flex flex-col h-full min-w-0"
      style={{ backgroundColor: colors.bgSecondary }}
    >
      {/* Header */}
      <div
        className="h-9 flex items-center px-4 border-b flex-shrink-0"
        style={{ borderColor: colors.border }}
      >
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.textSecondary }}>
          {tabLabels[activeTab]}
        </span>
        {currentConn && activeTab === 'files' && (
          <span className="ml-2 text-xs font-mono truncate" style={{ color: colors.textDim }}>
            — {currentConn.name}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'servers' ? (
          <div className="p-2">
            {/* 添加按钮 */}
            <button
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium mb-2 transition-colors"
              style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary, border: `1px solid ${colors.border}` }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              添加 SSH 连接
            </button>

            {connections.length === 0 ? (
              <div className="text-center py-10 px-4">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>暂无 SSH 连接</p>
                <p className="text-xs" style={{ color: colors.textDim }}>点击上方按钮添加服务器</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {connections.map((conn) => {
                  const active = currentConnectionId === conn.id
                  return (
                    <button
                      key={conn.id}
                      onClick={() => selectConnection(conn.id)}
                      className="w-full text-left px-3 py-2.5 rounded-md transition-all group"
                      style={{
                        backgroundColor: active ? `${colors.accent}15` : 'transparent',
                        borderLeft: active ? `3px solid ${colors.accent}` : '3px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: active ? colors.green : colors.textDim }} />
                        <span className="text-xs font-medium truncate" style={{ color: active ? colors.text : colors.textSecondary }}>
                          {conn.name}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono truncate pl-4" style={{ color: colors.textDim }}>
                        {conn.username}@{conn.host}:{conn.port}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'files' || activeTab === 'sftp' ? (
          <div>
            {currentConn ? (
              <div className="py-1">{renderTree(mockFileTree)}</div>
            ) : (
              <div className="text-center py-10 px-4">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>请先选择 SSH 连接</p>
                <p className="text-xs" style={{ color: colors.textDim }}>在「SSH 服务器」面板中添加并连接</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 px-4">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <p className="text-sm" style={{ color: colors.textSecondary }}>扩展</p>
            <p className="text-xs mt-1" style={{ color: colors.textDim }}>敬请期待</p>
          </div>
        )}
      </div>
    </div>
  )
}
