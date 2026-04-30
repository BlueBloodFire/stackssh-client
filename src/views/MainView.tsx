import { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { TerminalPanel } from '../components/TerminalPanel'
import { AgentChat } from '../components/AgentChat'
import { CodeEditor } from '../components/CodeEditor'

type ViewMode = 'terminal' | 'chat' | 'editor' | 'split-h' | 'split-v'

export function MainView() {
  const [viewMode, setViewMode] = useState<ViewMode>('split-h')

  return (
    <div className="h-full flex bg-[#1e1e1e]">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="h-10 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#cccccc]">视图:</span>
            <button
              onClick={() => setViewMode('terminal')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'terminal' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#3c3c3c]'
              }`}
            >
              终端
            </button>
            <button
              onClick={() => setViewMode('chat')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'chat' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#3c3c3c]'
              }`}
            >
              AI 对话
            </button>
            <button
              onClick={() => setViewMode('editor')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'editor' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#3c3c3c]'
              }`}
            >
              编辑器
            </button>
            <button
              onClick={() => setViewMode('split-h')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'split-h' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#3c3c3c]'
              }`}
            >
              左右分屏
            </button>
            <button
              onClick={() => setViewMode('split-v')}
              className={`px-2 py-1 text-xs rounded ${
                viewMode === 'split-v' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#3c3c3c]'
              }`}
            >
              上下分屏
            </button>
          </div>
          <div className="text-xs text-[#6a6a6a]">
            WaLiSSH v0.1.0
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 flex overflow-hidden">
          {viewMode === 'terminal' && <TerminalPanel />}
          {viewMode === 'chat' && <AgentChat />}
          {viewMode === 'editor' && <CodeEditor />}
          {viewMode === 'split-h' && (
            <>
              <div className="flex-1 border-r border-[#3c3c3c]">
                <TerminalPanel />
              </div>
              <div className="flex-1">
                <AgentChat />
              </div>
            </>
          )}
          {viewMode === 'split-v' && (
            <>
              <div className="flex-1 border-b border-[#3c3c3c]">
                <AgentChat />
              </div>
              <div className="flex-1">
                <TerminalPanel />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
