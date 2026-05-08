import { useMemo, useState } from 'react'
import { useThemeStore } from '../stores/themeStore'
import { useFileExplorerStore } from '../stores/fileExplorerStore'
import { useSshAgentStore } from '../stores/sshAgentStore'
import Editor from '@monaco-editor/react'

interface FileWorkspaceProps {
  activeTabKey: string | null
}

export function FileWorkspace({ activeTabKey }: FileWorkspaceProps) {
  const { colors, currentTheme } = useThemeStore()
  const { openTabs } = useFileExplorerStore()
  const [hasSelection, setHasSelection] = useState(false)

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.key === activeTabKey) ?? null,
    [openTabs, activeTabKey],
  )

  // 简单的扩展名推断语言
  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': case 'jsx': return 'javascript'
      case 'ts': case 'tsx': return 'typescript'
      case 'json': return 'json'
      case 'html': return 'html'
      case 'css': return 'css'
      case 'md': return 'markdown'
      case 'py': return 'python'
      case 'java': return 'java'
      case 'sh': case 'bash': return 'shell'
      case 'yml': case 'yaml': return 'yaml'
      case 'xml': return 'xml'
      case 'sql': return 'sql'
      default: return 'plaintext'
    }
  }

  return (
    <div className="h-full flex flex-col min-w-0" style={{ backgroundColor: colors.bgTertiary }}>
      <div className="flex-1 overflow-hidden relative">
        {!activeTab ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm" style={{ color: colors.textSecondary }}>暂无打开文件</p>
              <p className="text-xs mt-1" style={{ color: colors.textDim }}>从左侧文件树点击一个文件开始查看</p>
            </div>
          </div>
        ) : activeTab.loading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm" style={{ color: colors.textSecondary }}>文件加载中...</p>
          </div>
        ) : activeTab.error ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm" style={{ color: colors.red }}>{activeTab.error}</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {activeTab.binary && (
              <div className="text-xs px-3 py-2 shrink-0 border-b" style={{ backgroundColor: `${colors.yellow}10`, color: colors.yellow, borderColor: colors.border }}>
                当前文件疑似二进制，暂不支持在线预览。
              </div>
            )}
            {activeTab.truncated && !activeTab.binary && (
              <div className="text-xs px-3 py-2 shrink-0 border-b" style={{ backgroundColor: `${colors.yellow}10`, color: colors.yellow, borderColor: colors.border }}>
                文件过大，当前仅展示前 512KB 内容。
              </div>
            )}
            {!activeTab.binary && (
              <div className="flex-1 min-h-0 relative">
                {hasSelection && (
                  <div className="absolute top-2 right-6 z-10">
                    <button
                      onClick={() => {
                        // @ts-ignore
                        const editor = window.__activeMonacoEditor
                        if (editor) {
                          editor.getAction('add-to-ai-chat')?.run()
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded shadow-lg border transition-all hover:scale-105"
                      style={{
                        backgroundColor: colors.accent,
                        borderColor: colors.border,
                        color: '#fff',
                      }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span className="text-[11px] font-medium">发送选中内容至 AI</span>
                    </button>
                  </div>
                )}
                {!hasSelection && (
                  <div className="absolute top-2 right-6 z-10 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        // @ts-ignore
                        const editor = window.__activeMonacoEditor
                        if (editor) {
                          editor.getAction('add-to-ai-chat')?.run()
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded shadow-lg border transition-all hover:scale-105"
                      style={{
                        backgroundColor: colors.bgSecondary,
                        borderColor: colors.border,
                        color: colors.textSecondary,
                      }}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span className="text-[11px] font-medium">发送当前文件至 AI</span>
                    </button>
                  </div>
                )}
                <Editor
                  height="100%"
                  language={getLanguage(activeTab.name)}
                  theme={currentTheme === 'light' ? 'vs-light' : 'vs-dark'}
                  value={activeTab.content || ''}
                  onMount={(editor) => {
                    // @ts-ignore
                    window.__activeMonacoEditor = editor

                    editor.onDidChangeCursorSelection((e) => {
                      if (!e.selection.isEmpty()) {
                        setHasSelection(true)
                      } else {
                        setHasSelection(false)
                      }
                    })

                    editor.addAction({
                      id: 'add-to-ai-chat',
                      label: '添加到 AI 对话',
                      contextMenuGroupId: '1_modification',
                      contextMenuOrder: 1,
                      run: (ed) => {
                        const selection = ed.getSelection()
                        if (!selection) return
                        const text = ed.getModel()?.getValueInRange(selection)
                        
                        const currentActiveTabKey = useFileExplorerStore.getState().activeTabKey
                        const currentActiveTab = useFileExplorerStore.getState().openTabs.find(t => t.key === currentActiveTabKey)
                        if (!currentActiveTab) return

                        if (text && text.trim()) {
                          useSshAgentStore.getState().addInputTag({
                            label: '选中文本',
                            fullContent: `文件: ${currentActiveTab.path}\n选中的代码/文本:\n\`\`\`\n${text}\n\`\`\``,
                            type: 'custom'
                          })
                        } else {
                          // 没有选中文字时，添加整个文件
                          useSshAgentStore.getState().addInputTag({
                            label: `文件: ${currentActiveTab.name}`,
                            fullContent: `文件路径: ${currentActiveTab.path}\n\n${currentActiveTab.content}`,
                            type: 'file'
                          })
                        }
                      }
                    })
                  }}
                  options={{
                    readOnly: true,
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    renderWhitespace: 'selection',
                    padding: { top: 16 },
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
