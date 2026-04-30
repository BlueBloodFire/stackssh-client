import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)

  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
      },
      rows: 24,
      cols: 120,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const webglAddon = new WebglAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.loadAddon(webglAddon)

    term.open(terminalRef.current)
    fitAddon.fit()

    term.writeln('\x1b[1;32mWaLiSSH Terminal\x1b[0m')
    term.writeln('\x1b[33m---\x1b[0m')
    term.writeln('')
    term.writeln('\x1b[36m连接 SSH 后，此处将显示终端输出...\x1b[0m')
    term.writeln('')

    // 模拟输出
    term.writeln('\x1b[32muser@ssh-server:~$ \x1b[0m')

    terminalInstance.current = term

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      resizeObserver.disconnect()
      term.dispose()
      terminalInstance.current = null
    }
  }, [])

  return (
    <div className="flex-1 flex flex-col bg-[#1e1e1e]">
      {/* 终端标签栏 */}
      <div className="h-9 bg-[#252526] border-b border-[#3c3c3c] flex items-center px-2">
        <div className="px-3 py-1 text-sm text-white bg-[#1e1e1e] border-t-2 border-[#007acc] rounded-t">
          Terminal
        </div>
      </div>
      {/* 终端内容 */}
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  )
}
