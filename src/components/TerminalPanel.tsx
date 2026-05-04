import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSshAgentStore } from '../stores/sshAgentStore'
import { openTerminal, writeInput, readOutput, resizeTerminal, closeTerminal } from '../api/terminal'
import { ConnectionStatus } from '../types'

/** 终端会话状态 */
interface TerminalSession {
  sessionId: string
  connectionId: string
}

/** 每个连接持有的终端状态 */
interface ConnectionTerminalState {
  terminal: Terminal
  fitAddon: FitAddon
  container: HTMLDivElement
  session: TerminalSession | null
  pollTimer: ReturnType<typeof setInterval> | null
  onDataDisposable: { dispose(): void } | null
  disconnected: boolean
  connecting: boolean
  resizeObserver: ResizeObserver | null
  lastSentSize: { cols: number; rows: number }
  inputBuffer: string[] | null
  inputFlushTimer: ReturnType<typeof setTimeout> | null
}

/** 轮询间隔（ms） */
const POLL_INTERVAL = 50

/** 后端返回的断连标记 */
const DISCONNECT_MARKER = '[连接已断开]'

/** 轮询连续错误阈值 */
const POLL_ERROR_THRESHOLD = 3

/** 重连退避间隔（ms） */
const RECONNECT_INTERVAL = 5000

/** 右键菜单位置 */
interface ContextMenuPos {
  x: number
  y: number
}

export function TerminalPanel({
  onTerminalSessionChange,
}: {
  /** 终端会话变化回调 */
  onTerminalSessionChange?: (sessionId: string | null) => void
}) {
  const { colors } = useThemeStore()
  const { currentConnectionId, connections, connect, disconnect } = useConnectionStore()
  const { setTerminalSelection } = useSshAgentStore()

  const terminalStates = useRef<Map<string, ConnectionTerminalState>>(new Map())
  const wrapperRef = useRef<HTMLDivElement>(null)
  const activeConnectionIdRef = useRef<string | null>(null)

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    pos: ContextMenuPos
    selectedText: string
  }>({ visible: false, pos: { x: 0, y: 0 }, selectedText: '' })

  const currentConn = connections.find((c) => c.id === currentConnectionId)

  /** 获取当前终端会话 ID */
  const getCurrentTerminalSessionId = useCallback(() => {
    if (!currentConnectionId) return null
    const state = terminalStates.current.get(currentConnectionId)
    return state?.session?.sessionId || null
  }, [currentConnectionId])

  /** 通知父组件终端会话变化 */
  useEffect(() => {
    const sessionId = getCurrentTerminalSessionId()
    onTerminalSessionChange?.(sessionId)
  }, [currentConnectionId, getCurrentTerminalSessionId, onTerminalSessionChange])

  /** 创建 xterm Terminal 实例 */
  const createTerminalInstance = useCallback(() => {
    return new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      scrollback: 100000,
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
      allowProposedApi: false,
    })
  }, [colors])

  /** 停止指定连接的轮询 */
  const stopPolling = useCallback((state: ConnectionTerminalState) => {
    if (state.pollTimer) {
      clearInterval(state.pollTimer)
      state.pollTimer = null
    }
  }, [])

  /** 标记终端断开并清理 */
  const markDisconnected = useCallback((state: ConnectionTerminalState, reason: string) => {
    if (state.disconnected) return
    state.disconnected = true
    stopPolling(state)

    const conn = connections.find((c) => c.id === state.session!.connectionId)
    if (conn && conn.status === ConnectionStatus.CONNECTED) {
      disconnect(conn.id).catch(() => {})
    }

    state.terminal.writeln(`\x1b[33m\r\n*** ${reason} ***\x1b[0m`)
  }, [stopPolling, connections, disconnect])

  /** 启动轮询 */
  const startPolling = useCallback((state: ConnectionTerminalState) => {
    stopPolling(state)
    const sessionId = state.session!.sessionId
    let errorCount = 0

    state.pollTimer = setInterval(async () => {
      try {
        const res = await readOutput(sessionId)

        if (res.code === '0000') {
          errorCount = 0
          if (res.data?.output) {
            const output = res.data.output
            if (output.includes(DISCONNECT_MARKER)) {
              markDisconnected(state, '连接已断开')
              return
            }
            state.terminal.write(output)
          }
          return
        }

        if (res.code === 'ILLEGAL_PARAMETER' && res.info?.includes('不存在')) {
          markDisconnected(state, '会话已失效')
          return
        }

        errorCount++
        if (errorCount >= POLL_ERROR_THRESHOLD) {
          markDisconnected(state, '连接异常')
        }
      } catch {
        errorCount++
        if (errorCount >= POLL_ERROR_THRESHOLD) {
          markDisconnected(state, '网络异常')
        }
      }
    }, POLL_INTERVAL)
  }, [stopPolling, markDisconnected])

  /** 销毁指定连接的终端 */
  const destroyTerminal = useCallback((connectionId: string) => {
    const state = terminalStates.current.get(connectionId)
    if (!state) return

    stopPolling(state)

    if (state.inputFlushTimer) {
      clearTimeout(state.inputFlushTimer)
    }

    if (state.session) {
      closeTerminal(state.session.sessionId).catch(() => {})
    }

    state.onDataDisposable?.dispose()
    state.resizeObserver?.disconnect()
    state.terminal.dispose()
    state.container.remove()

    terminalStates.current.delete(connectionId)
  }, [stopPolling])

  /** 创建并打开终端会话 */
  const openTerminalSession = useCallback(async (connectionId: string) => {
    const existingState = terminalStates.current.get(connectionId)
    if (existingState && existingState.connecting) return
    if (existingState && existingState.session && !existingState.disconnected) return
    if (existingState && existingState.disconnected) {
      destroyTerminal(connectionId)
    }

    if (!wrapperRef.current) return

    const term = createTerminalInstance()
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)

    try {
      term.loadAddon(new WebglAddon())
    } catch {
      /* WebGL 不可用时降级 */
    }

    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;padding:8px;overflow:hidden;'
    wrapperRef.current.appendChild(container)

    // 添加右键菜单事件
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const selection = term.getSelection()
      if (selection) {
        setContextMenu({
          visible: true,
          pos: { x: e.clientX, y: e.clientY },
          selectedText: selection,
        })
      }
    })

    term.open(container)
    fitAddon.fit()

    const state: ConnectionTerminalState = {
      terminal: term,
      fitAddon,
      container,
      session: null,
      pollTimer: null,
      onDataDisposable: null,
      disconnected: false,
      connecting: true,
      resizeObserver: null,
      lastSentSize: { cols: term.cols, rows: term.rows },
      inputBuffer: null,
      inputFlushTimer: null,
    }
    terminalStates.current.set(connectionId, state)

    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (resizeTimer) return
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        if (!state.session) return
        fitAddon.fit()
        if (term.cols > 0 && term.rows > 0) {
          const { cols, rows } = term
          if (cols === state.lastSentSize.cols && rows === state.lastSentSize.rows) return
          state.lastSentSize = { cols, rows }
          resizeTerminal({ sessionId: state.session.sessionId, cols, rows }).catch(() => {})
        }
      }, 300)
    })
    ro.observe(container)
    state.resizeObserver = ro

    try {
      const res = await openTerminal({
        connectionId,
        cols: term.cols,
        rows: term.rows,
      })

      if (res.code !== '0000' || !res.data) {
        term.writeln(`\x1b[31m打开终端失败: ${res.info}\x1b[0m`)
        state.connecting = false
        return
      }

      const { sessionId, initialOutput } = res.data!
      state.session = { sessionId, connectionId }

      // 通知父组件会话已建立
      if (connectionId === currentConnectionId) {
        onTerminalSessionChange?.(sessionId)
      }

      if (initialOutput) {
        term.write(initialOutput)
      }

      state.onDataDisposable = term.onData((data) => {
        if (state.disconnected || !state.session) return

        if (!state.inputBuffer) {
          state.inputBuffer = []
          state.inputFlushTimer = setTimeout(() => {
            if (state.inputBuffer && state.session && !state.disconnected) {
              const input = state.inputBuffer.join('')
              writeInput({ sessionId: state.session.sessionId, input }).catch(() => {
                term.writeln('\r\n\x1b[31m输入发送失败\x1b[0m')
              })
            }
            state.inputBuffer = null
            state.inputFlushTimer = null
          }, 10)
        }
        state.inputBuffer.push(data)
      })

      startPolling(state)
    } catch (err: any) {
      term.writeln(`\x1b[31m连接错误: ${err.message || '未知错误'}\x1b[0m`)
    } finally {
      state.connecting = false
    }
  }, [createTerminalInstance, destroyTerminal, startPolling])

  /** 切换终端显示 */
  useEffect(() => {
    activeConnectionIdRef.current = currentConnectionId
    terminalStates.current.forEach((state, connId) => {
      const isActive = connId === currentConnectionId
      state.container.style.visibility = isActive ? 'visible' : 'hidden'
      state.container.style.zIndex = isActive ? '1' : '0'
      if (isActive && state.session && !state.disconnected) {
        requestAnimationFrame(() => {
          state.terminal.focus()
        })
      }
    })
    // 切换连接时通知父组件当前会话ID
    const activeState = currentConnectionId ? terminalStates.current.get(currentConnectionId) : undefined
    onTerminalSessionChange?.(activeState?.session?.sessionId ?? null)
  }, [currentConnectionId, onTerminalSessionChange])

  /** 监听连接状态变化 */
  useEffect(() => {
    if (!currentConn) return

    const isConnected = currentConn.status === ConnectionStatus.CONNECTED
    const state = terminalStates.current.get(currentConn.id)

    if (isConnected) {
      if (!state) {
        openTerminalSession(currentConn.id)
      } else if (state.disconnected) {
        destroyTerminal(currentConn.id)
        openTerminalSession(currentConn.id)
      }
    } else {
      if (state) {
        destroyTerminal(currentConn.id)
      }
    }
  }, [currentConn, openTerminalSession, destroyTerminal])

  /** 组件卸载清理 */
  useEffect(() => {
    return () => {
      terminalStates.current.forEach((_, connId) => {
        destroyTerminal(connId)
      })
    }
  }, [destroyTerminal])

  /** 重新连接 */
  const handleReconnect = useCallback((connectionId: string) => {
    destroyTerminal(connectionId)
    openTerminalSession(connectionId)
  }, [destroyTerminal, openTerminalSession])

  /** 处理添加到对话 */
  const handleAddToChat = useCallback(() => {
    if (contextMenu.selectedText) {
      setTerminalSelection({
        text: contextMenu.selectedText,
        terminalSessionId: getCurrentTerminalSessionId() || '',
        selectedAt: Date.now(),
      })
    }
    setContextMenu((prev) => ({ ...prev, visible: false }))
  }, [contextMenu.selectedText, getCurrentTerminalSessionId, setTerminalSelection])

  /** 处理复制 */
  const handleCopy = useCallback(() => {
    if (contextMenu.selectedText) {
      navigator.clipboard.writeText(contextMenu.selectedText)
    }
    setContextMenu((prev) => ({ ...prev, visible: false }))
  }, [contextMenu.selectedText])

  /** 点击其他地方关闭右键菜单 */
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu((prev) => ({ ...prev, visible: false }))
    }
    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu.visible])

  const currentState = currentConn ? terminalStates.current.get(currentConn.id) : undefined

  if (!currentConn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-w-0" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🖥️</div>
          <h2 className="text-lg font-medium mb-2" style={{ color: colors.text }}>
            未连接 SSH 服务器
          </h2>
          <p className="text-sm mb-6" style={{ color: colors.textDim }}>
            请在左侧选择或添加 SSH 连接
          </p>
        </div>
      </div>
    )
  }

  const isConnected = currentConn.status === ConnectionStatus.CONNECTED

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: colors.bgPrimary }}>
      {/* 终端工具栏 */}
      <div className="h-9 flex items-center justify-between px-3 border-b flex-shrink-0" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isConnected ? colors.green : colors.yellow }} />
          <span className="text-xs font-medium" style={{ color: colors.text }}>
            {currentConn.name}
          </span>
          <span className="text-[10px] font-mono" style={{ color: colors.textDim }}>
            {currentConn.username}@{currentConn.host}:{currentConn.port}
          </span>
          {currentState?.disconnected && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.red + '20', color: colors.red }}>
              已断开
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {currentState?.disconnected ? (
            <button
              onClick={() => handleReconnect(currentConn.id)}
              className="px-2 py-1 rounded text-[11px] font-medium transition-colors"
              style={{ backgroundColor: colors.green, color: '#ffffff' }}
            >
              重新连接
            </button>
          ) : (
            <>
              <button
                onClick={() => currentState?.terminal.clear()}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                style={{ color: colors.textDim }}
                title="清屏"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
              <button
                onClick={async () => {
                  destroyTerminal(currentConn.id)
                  await disconnect(currentConn.id)
                }}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                style={{ color: colors.textDim }}
                title="断开连接"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 终端容器 */}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        <div ref={wrapperRef} className="absolute inset-0" />

        {/* 非 CONNECTED 状态：遮罩层 */}
        {!isConnected && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center" style={{ backgroundColor: colors.bgPrimary }}>
            {currentConn.status === ConnectionStatus.CONNECTING && (
              <div className="text-center">
                <div className="animate-spin text-4xl mb-4" style={{ color: colors.accent }}>⚙️</div>
                <p style={{ color: colors.text }}>正在连接 {currentConn.name}...</p>
              </div>
            )}
            {currentConn.status === ConnectionStatus.FAILED && (
              <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h2 className="text-lg font-medium mb-2" style={{ color: colors.red }}>连接失败</h2>
                <p className="text-sm mb-6" style={{ color: colors.textDim }}>
                  {currentConn.name} 无法连接
                </p>
                <button
                  onClick={() => connect(currentConn.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: colors.accent, color: '#ffffff' }}
                >
                  重试连接
                </button>
              </div>
            )}
            {currentConn.status === ConnectionStatus.DISCONNECTED && (
              <div className="text-center">
                <div className="text-6xl mb-4">🔌</div>
                <h2 className="text-lg font-medium mb-2" style={{ color: colors.text }}>
                  {currentConn.name}
                </h2>
                <p className="text-sm mb-2" style={{ color: colors.textDim }}>
                  {currentConn.username}@{currentConn.host}:{currentConn.port}
                </p>
                <p className="text-sm mb-6" style={{ color: colors.textDim }}>
                  点击下方按钮建立 SSH 连接
                </p>
                <button
                  onClick={() => connect(currentConn.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: colors.accent, color: '#ffffff' }}
                >
                  连接服务器
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 断连提示 */}
      {currentState?.disconnected && (
        <div className="p-3 border-t flex items-center justify-between" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
          <span className="text-xs" style={{ color: colors.red }}>
            ⚠️ 终端连接已断开
          </span>
          <button
            onClick={() => handleReconnect(currentConn.id)}
            className="px-3 py-1 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: colors.accent, color: '#ffffff' }}
          >
            重新连接
          </button>
        </div>
      )}

      {/* 右键菜单 */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 rounded-lg py-1 shadow-lg border"
          style={{
            left: contextMenu.pos.x,
            top: contextMenu.pos.y,
            backgroundColor: colors.bgPrimary,
            borderColor: colors.border,
            minWidth: '140px',
          }}
        >
          <button
            onClick={handleAddToChat}
            className="w-full px-3 py-2 text-left text-[12px] hover:bg-black/5 flex items-center gap-2"
            style={{ color: colors.text }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            添加到对话
          </button>
          <button
            onClick={handleCopy}
            className="w-full px-3 py-2 text-left text-[12px] hover:bg-black/5 flex items-center gap-2"
            style={{ color: colors.text }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            复制
          </button>
        </div>
      )}
    </div>
  )
}
