import { useState, useEffect, useCallback } from 'react'
import { Header } from '../components/Header'
import { ActivityBar } from '../components/ActivityBar'
import { LeftSidebar } from '../components/LeftSidebar'
import { RightSidebar } from '../components/RightSidebar'
import { TerminalPanel } from '../components/TerminalPanel'
import { WorkbenchPanel } from '../components/WorkbenchPanel'
import { Settings } from '../components/Settings'
import { SSHConnectionModal } from '../components/SSHConnectionModal'
import { useThemeStore } from '../stores/themeStore'

type TabId = 'servers' | 'files' | 'sftp' | 'extensions'

/**
 * MainView V3 - SSH 会话优化版
 *
 * 优化内容：
 * 1. 终端会话保持在全局层级，不因标签页切换而销毁
 * 2. 从文件目录切回 SSH 服务器时，连接保持
 * 3. 终端与工作区共用同一套连接会话
 *
 * 集成 SSH 智能体交互功能：
 * 1. 终端会话变化时通知右侧 AI 面板
 * 2. 终端选中内容可右键添加到对话
 * 3. AI 面板自动绑定当前 SSH 连接
 */
export function MainView() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sshModalOpen, setSshModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('servers')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [chatVisible, setChatVisible] = useState(true)
  const [chatWidth, setChatWidth] = useState(400)
  const [terminalVisible, setTerminalVisible] = useState(true)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingChat, setIsResizingChat] = useState(false)
  
  // 当前激活的终端会话 ID
  const [activeTerminalSessionId, setActiveTerminalSessionId] = useState<string | null>(null)

  const { colors } = useThemeStore()

  // Sidebar 拖拽
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingSidebar(true)
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(newWidth)
    }

    const onMouseUp = () => {
      setIsResizingSidebar(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth])

  // Chat 拖拽
  const handleChatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingChat(true)
    const startX = e.clientX
    const startWidth = chatWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(700, startWidth - (moveEvent.clientX - startX)))
      setChatWidth(newWidth)
    }

    const onMouseUp = () => {
      setIsResizingChat(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [chatWidth])

  useEffect(() => {
    document.body.style.backgroundColor = colors.bgPrimary
    document.body.style.color = colors.text
  }, [colors])

  // 处理终端会话变化
  const handleTerminalSessionChange = useCallback((sessionId: string | null) => {
    setActiveTerminalSessionId(sessionId)
  }, [])

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ backgroundColor: colors.bgPrimary }}>
      {/* ===== 顶部标题栏 ===== */}
      <Header
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        sidebarVisible={sidebarVisible}
        onToggleTerminal={() => setTerminalVisible(!terminalVisible)}
        terminalVisible={terminalVisible}
        onToggleChat={() => setChatVisible(!chatVisible)}
        chatVisible={chatVisible}
        onOpenSSHModal={() => setSshModalOpen(true)}
      />

      {/* ===== 主体区域 ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：ActivityBar + Sidebar */}
        {sidebarVisible && (
          <>
            <ActivityBar activeTab={activeTab} onTabChange={setActiveTab} onOpenSettings={() => setSettingsOpen(true)} />

            <div
              className="flex-shrink-0 transition-none overflow-hidden relative"
              style={{ width: sidebarWidth }}
            >
              <LeftSidebar activeTab={activeTab} />
            </div>

            {/* Sidebar 拖拽条 */}
            <div
              className="w-1.5 h-full cursor-col-resize relative z-50 flex-shrink-0"
              style={{ backgroundColor: isResizingSidebar ? colors.accent : 'transparent' }}
              onMouseDown={handleSidebarResizeStart}
            >
              <div
                className={`absolute inset-y-0 -left-[3px] -right-[3px] ${isResizingSidebar ? '' : 'hover:bg-blue-500/30'} rounded-full`}
              />
            </div>
          </>
        )}

        {/* 中间：根据左侧 Tab 切换工作区 */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          {/* 全局终端面板 - 始终保持挂载，只控制可见性 */}
          <div 
            className="absolute inset-0 z-10"
            style={{ 
              display: activeTab === 'servers' && terminalVisible ? 'block' : 'none',
            }}
          >
            <TerminalPanel onTerminalSessionChange={handleTerminalSessionChange} />
          </div>

          {/* 服务器标签页 - 终端隐藏时的提示 */}
          {activeTab === 'servers' && !terminalVisible && (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: colors.textDim }}>终端已隐藏 (按 ⌘` 显示)</p>
            </div>
          )}

          {/* 文件/工作区标签页 */}
          {(activeTab === 'files' || activeTab === 'sftp') && (
            <WorkbenchPanel
              terminalVisible={terminalVisible}
              onTerminalSessionChange={handleTerminalSessionChange}
              // 传入一个标志，表示终端已经在全局管理了
              globalTerminalManaged={true}
            />
          )}

          {activeTab === 'extensions' && (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: colors.textDim }}>扩展面板开发中</p>
            </div>
          )}
        </div>

        {/* 右侧：AI 对话面板 */}
        {chatVisible && (
          <>
            {/* Chat 拖拽条 */}
            <div
              className="w-1.5 h-full cursor-col-resize relative z-50 flex-shrink-0 bg-[#3c3c3c]/40"
              style={{ backgroundColor: isResizingChat ? colors.accent : undefined }}
              onMouseDown={handleChatResizeStart}
            >
              <div
                className={`absolute inset-y-0 -left-[3px] -right-[3px] ${isResizingChat ? '' : 'hover:bg-blue-500/30'} rounded-full`}
              />
            </div>
            <RightSidebar width={chatWidth} activeTerminalSessionId={activeTerminalSessionId} />
          </>
        )}
      </div>

      {/* SSH 连接配置弹窗 */}
      <SSHConnectionModal open={sshModalOpen} onClose={() => setSshModalOpen(false)} />

      {/* 设置弹窗 */}
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
