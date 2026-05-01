import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'

export function TerminalPanel() {
  const { colors } = useThemeStore()
  const { currentConnectionId, connections } = useConnectionStore()
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const [, setShowNewConnection] = useState(false)

  const currentConn = connections.find((c) => c.id === currentConnectionId)

  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      theme: {
        background: colors.bgPrimary,
        foreground: colors.text,
        cursor: colors.accent,
        cursorAccent: colors.bgPrimary,
        selectionBackground: colors.accent + '50',
        selectionForeground: '#ffffff',
        black: '#000000',
        red: colors.red,
        green: colors.green,
        yellow: colors.yellow,
        blue: colors.accent,
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: colors.text,
        brightBlack: '#555555',
        brightRed: colors.red,
        brightGreen: colors.green,
        brightYellow: colors.yellow,
        brightBlue: colors.accent,
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      rows: 24,
      cols: 120,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())

    try {
      term.loadAddon(new WebglAddon())
    } catch { /* 降级 */ }

    term.open(terminalRef.current)
    fitAddon.fit()

    // 欢迎信息
    term.writeln('')
    term.writeln(`\x1b[1;36m  WaLiSSH Terminal\x1b[0m \x1b[90mv0.1.0\x1b[0m`)
    term.writeln('')
    term.writeln(`\x1b[90m  当前连接: ${currentConn ? currentConn.name : '未连接'}\x1b[0m`)
    term.writeln('')
    term.write('\x1b[32m❯ \x1b[0m')

    terminalInstance.current = term

    const ro = new ResizeObserver(() => fitAddon.fit())
    ro.observe(terminalRef.current)

    return () => {
      ro.disconnect()
      term.dispose()
      terminalInstance.current = null
    }
  }, [colors, currentConn])

  // 如果没有连接，显示连接界面
  if (!currentConn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-w-0" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🖥️</div>
          <h2 className="text-lg font-medium mb-2" style={{ color: colors.text }}>未连接 SSH 服务器</h2>
          <p className="text-sm mb-6" style={{ color: colors.textDim }}>请在左侧选择或添加 SSH 连接</p>
          <button
            onClick={() => setShowNewConnection(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: colors.accent, color: '#fff' }}
          >
            + 新建连接
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: colors.bgPrimary }}>
      {/* 终端工具栏 */}
      <div
        className="h-9 flex items-center justify-between px-3 border-b flex-shrink-0"
        style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.green }} />
          <span className="text-xs font-medium" style={{ color: colors.text }}>{currentConn.name}</span>
          <span className="text-[10px] font-mono" style={{ color: colors.textDim }}>
            {currentConn.username}@{currentConn.host}:{currentConn.port}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: colors.textDim }}
            title="分屏"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
              <line x1="12" y1="3" x2="12" y2="21"></line>
            </svg>
          </button>
          <button
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: colors.textDim }}
            title="搜索"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          <button
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: colors.textDim }}
            title="断开连接"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* 终端内容区 */}
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  )
}
