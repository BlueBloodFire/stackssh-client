import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useSshAgentStore } from '../stores/sshAgentStore'
import {
  openTerminal, writeInput, readOutput, resizeTerminal, closeTerminal,
  checkCommand, startRecording, stopRecording, listRecordings,
  type TerminalRecording,
} from '../api/terminal'
import { ConnectionStatus } from '../types'
import { COMMAND_CATEGORIES, type CommandCategory, type CommandItem } from './CommandData/commandData'
import { TerminalPlayback } from './TerminalPlayback'

// ===== 类型定义 =====

interface TerminalSession {
  sessionId: string
  connectionId: string
}

interface TerminalTab {
  tabId: string
  connectionId: string
  label: string
}

interface ConnectionTerminalState {
  terminal: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
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
  /** 当前正在输入的行内容（用于危险命令检测） */
  currentLineBuffer: string
  /** 是否等待危险命令确认 */
  pendingDangerConfirm: boolean
  /** 暂存的 Enter 键（确认后发送） */
  pendingEnter: string | null
}

interface ContextMenuPos {
  x: number
  y: number
}

interface TerminalPanelProps {
  onTerminalSessionChange?: (sessionId: string | null) => void
  keepSessionOnUnmount?: boolean
}

// ===== 全局状态（模块级，跨组件保持） =====

/** tabId -> 终端状态 */
const globalTerminalStates = new Map<string, ConnectionTerminalState>()

/** connectionId -> 标签列表 */
const globalTerminalTabs = new Map<string, TerminalTab[]>()

/** connectionId -> 当前激活的 tabId */
const globalActiveTabId = new Map<string, string>()

/** connectionId -> 命令历史 */
const globalCommandHistory = new Map<string, string[]>()

const POLL_INTERVAL = 50
const DISCONNECT_MARKER = '[连接已断开]'
const POLL_ERROR_THRESHOLD = 3

let tabCounter = 0
function nextTabLabel() {
  return `终端 ${++tabCounter}`
}

// ===== 组件 =====

export function TerminalPanel({
  onTerminalSessionChange,
  keepSessionOnUnmount = true,
}: TerminalPanelProps) {
  const { colors } = useThemeStore()
  const { currentConnectionId, connections, connect, disconnect } = useConnectionStore()
  const { addInputTag } = useSshAgentStore()

  const terminalStates = useRef(globalTerminalStates)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // ---- 标签页状态 ----
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [, setActiveTabIdState] = useState<string | null>(null)

  // ---- UI 状态 ----
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; pos: ContextMenuPos; selectedText: string }>(
    { visible: false, pos: { x: 0, y: 0 }, selectedText: '' }
  )
  const [showCommandSidebar, setShowCommandSidebar] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState<string[]>([])
  const [dangerDialog, setDangerDialog] = useState<{ visible: boolean; command: string; warning: string; tabId: string }>({
    visible: false, command: '', warning: '', tabId: ''
  })
  // 录制
  const [isRecording, setIsRecording] = useState(false)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [showPlayback, setShowPlayback] = useState(false)
  const [recordings, setRecordings] = useState<TerminalRecording[]>([])
  const [showRecordingList, setShowRecordingList] = useState(false)
  const [playbackRecordingId, setPlaybackRecordingId] = useState<string | null>(null)

  const currentConn = connections.find((c) => c.id === currentConnectionId)
  const isConnected = currentConn?.status === ConnectionStatus.CONNECTED

  // ---- 辅助：同步标签状态到 React ----
  const syncTabs = useCallback((connectionId: string) => {
    const t = globalTerminalTabs.get(connectionId) ?? []
    const a = globalActiveTabId.get(connectionId) ?? null
    setTabs([...t])
    setActiveTabIdState(a)
    // 同步历史
    setHistoryList([...(globalCommandHistory.get(connectionId) ?? [])])
  }, [])

  // ---- 停止轮询 ----
  const stopPolling = useCallback((state: ConnectionTerminalState) => {
    if (state.pollTimer) {
      clearInterval(state.pollTimer)
      state.pollTimer = null
    }
  }, [])

  // ---- 标记断连 ----
  const markDisconnected = useCallback(async (state: ConnectionTerminalState, reason: string) => {
    if (state.disconnected) return
    state.disconnected = true
    stopPolling(state)
    const conn = connections.find((c) => c.id === state.session?.connectionId)
    if (conn?.status === ConnectionStatus.CONNECTED) {
      try { await disconnect(conn.id) } catch { /* ignore */ }
    }
    state.terminal.writeln(`\x1b[33m\r\n*** ${reason} ***\x1b[0m`)
  }, [stopPolling, connections, disconnect])

  // ---- 启动轮询 ----
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
            if (res.data.output.includes(DISCONNECT_MARKER)) {
              markDisconnected(state, '连接已断开')
              return
            }
            state.terminal.write(res.data.output)
          }
          return
        }
        if (res.code === 'ILLEGAL_PARAMETER' && res.info?.includes('不存在')) {
          markDisconnected(state, '会话已失效')
          return
        }
        errorCount++
        if (errorCount >= POLL_ERROR_THRESHOLD) markDisconnected(state, '连接异常')
      } catch {
        errorCount++
        if (errorCount >= POLL_ERROR_THRESHOLD) markDisconnected(state, '网络异常')
      }
    }, POLL_INTERVAL)
  }, [stopPolling, markDisconnected])

  // ---- 销毁单个 tab 的终端 ----
  const destroyTab = useCallback((tabId: string) => {
    const state = terminalStates.current.get(tabId)
    if (!state) return
    stopPolling(state)
    if (state.inputFlushTimer) clearTimeout(state.inputFlushTimer)
    if (state.session) closeTerminal(state.session.sessionId).catch(() => {})
    state.onDataDisposable?.dispose()
    state.resizeObserver?.disconnect()
    state.terminal.dispose()
    if (state.container.parentNode) state.container.remove()
    terminalStates.current.delete(tabId)
  }, [stopPolling])

  // ---- 创建并打开终端会话 ----
  const openTerminalSession = useCallback(async (tabId: string, connectionId: string) => {
    const existing = terminalStates.current.get(tabId)
    if (existing?.connecting) return
    if (existing) destroyTab(tabId)
    if (!wrapperRef.current) return

    const term = new Terminal({
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

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    try { term.loadAddon(new WebglAddon()) } catch { /* WebGL 不可用降级 */ }

    // Ctrl+F 打开搜索
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        setShowSearch(true)
        return false
      }
      if (e.type === 'keydown' && e.key === 'Escape') {
        setShowSearch(false)
        return true
      }
      return true
    })

    const container = document.createElement('div')
    container.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;padding:0 8px 25px 8px;overflow:hidden;'
    wrapperRef.current.appendChild(container)

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const sel = term.getSelection()
      if (sel) setContextMenu({ visible: true, pos: { x: e.clientX, y: e.clientY }, selectedText: sel })
    })
    container.addEventListener('mouseup', (e) => {
      setTimeout(() => {
        const sel = term.getSelection()
        if (sel?.trim()) {
          setContextMenu({ visible: true, pos: { x: e.clientX, y: e.clientY }, selectedText: sel })
        } else if (e.button !== 2) {
          setContextMenu((p) => ({ ...p, visible: false }))
        }
      }, 50)
    })

    term.open(container)
    fitAddon.fit()

    const state: ConnectionTerminalState = {
      terminal: term,
      fitAddon,
      searchAddon,
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
      currentLineBuffer: '',
      pendingDangerConfirm: false,
      pendingEnter: null,
    }
    terminalStates.current.set(tabId, state)

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (resizeTimer) return
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        if (!state.session) return
        fitAddon.fit()
        const { cols, rows } = term
        if (cols <= 0 || rows <= 0) return
        if (cols === state.lastSentSize.cols && rows === state.lastSentSize.rows) return
        state.lastSentSize = { cols, rows }
        resizeTerminal({ sessionId: state.session.sessionId, cols, rows }).catch(() => {})
      }, 300)
    })
    ro.observe(container)
    state.resizeObserver = ro

    try {
      const res = await openTerminal({ connectionId, cols: term.cols, rows: term.rows })
      if (res.code !== '0000' || !res.data) {
        term.writeln(`\x1b[31m打开终端失败: ${res.info}\x1b[0m`)
        state.connecting = false
        return
      }

      const { sessionId, initialOutput } = res.data!
      state.session = { sessionId, connectionId }

      if (globalActiveTabId.get(connectionId) === tabId) {
        onTerminalSessionChange?.(sessionId)
      }

      if (initialOutput) term.write(initialOutput)

      state.onDataDisposable = term.onData(async (data) => {
        if (state.disconnected || !state.session) return
        if (state.pendingDangerConfirm) return // 等待用户确认时屏蔽输入

        // ---- 命令历史 & 危险命令检测 ----
        if (data === '\r' || data === '\n') {
          const cmd = state.currentLineBuffer.trim()
          state.currentLineBuffer = ''

          if (cmd) {
            // 记录命令历史
            const history = globalCommandHistory.get(connectionId) ?? []
            if (history[history.length - 1] !== cmd) {
              history.push(cmd)
              if (history.length > 200) history.shift()
            }
            globalCommandHistory.set(connectionId, history)
            setHistoryList([...history])

            // 异步检测危险命令
            try {
              const checkRes = await checkCommand(cmd)
              if (checkRes.data?.dangerous) {
                state.pendingDangerConfirm = true
                state.pendingEnter = data
                setDangerDialog({ visible: true, command: cmd, warning: checkRes.data.warning ?? '危险命令！', tabId })
                return // 不立即发送 Enter
              }
            } catch { /* 检测失败则放行 */ }
          }
        } else if (data === '\x7f' || data === '\b') {
          // Backspace
          state.currentLineBuffer = state.currentLineBuffer.slice(0, -1)
        } else if (!data.startsWith('\x1b') && data >= ' ') {
          state.currentLineBuffer += data
        }

        // ---- 正常发送 ----
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
  }, [colors, destroyTab, startPolling, onTerminalSessionChange])

  // ---- 新建 tab ----
  const createNewTab = useCallback((connectionId: string) => {
    const tabId = `${connectionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`
    const label = nextTabLabel()
    const tab: TerminalTab = { tabId, connectionId, label }
    const tabs = globalTerminalTabs.get(connectionId) ?? []
    tabs.push(tab)
    globalTerminalTabs.set(connectionId, tabs)
    globalActiveTabId.set(connectionId, tabId)
    return tabId
  }, [])

  // ---- 激活某个 tab ----
  const activateTab = useCallback((tabId: string, connectionId: string) => {
    globalActiveTabId.set(connectionId, tabId)
    setActiveTabIdState(tabId)

    // 切换 DOM 显示
    if (!wrapperRef.current) return
    terminalStates.current.forEach((state) => {
      if (state.container.parentNode) state.container.parentNode.removeChild(state.container)
    })
    const state = terminalStates.current.get(tabId)
    if (state) {
      wrapperRef.current.appendChild(state.container)
      requestAnimationFrame(() => state.terminal.focus())
    }

    const session = terminalStates.current.get(tabId)?.session
    onTerminalSessionChange?.(session?.sessionId ?? null)
  }, [onTerminalSessionChange])

  // ---- 关闭 tab ----
  const closeTab = useCallback((tabId: string, connectionId: string) => {
    destroyTab(tabId)
    const tabs = (globalTerminalTabs.get(connectionId) ?? []).filter((t) => t.tabId !== tabId)
    globalTerminalTabs.set(connectionId, tabs)

    if (tabs.length === 0) {
      globalActiveTabId.delete(connectionId)
      setActiveTabIdState(null)
      setTabs([])
      onTerminalSessionChange?.(null)
    } else {
      const newActive = tabs[tabs.length - 1].tabId
      globalActiveTabId.set(connectionId, newActive)
      setTabs([...tabs])
      setActiveTabIdState(newActive)
      activateTab(newActive, connectionId)
    }
  }, [destroyTab, activateTab, onTerminalSessionChange])

  // ---- 监听连接状态变化 ----
  useEffect(() => {
    if (!currentConn) return
    const connId = currentConn.id

    if (currentConn.status === ConnectionStatus.CONNECTED) {
      const existingTabs = globalTerminalTabs.get(connId) ?? []
      if (existingTabs.length === 0) {
        const tabId = createNewTab(connId)
        syncTabs(connId)
        openTerminalSession(tabId, connId)
      } else {
        // 已有 tab，检查活跃 tab 是否健在
        const activeTabId = globalActiveTabId.get(connId)
        if (activeTabId) {
          const state = terminalStates.current.get(activeTabId)
          if (state?.disconnected) {
            destroyTab(activeTabId)
            openTerminalSession(activeTabId, connId)
          }
        }
        syncTabs(connId)
      }
    } else {
      // 连接断开：清理所有 tab，并通知 MainView 清空 activeTerminalSessionId
      const existingTabs = globalTerminalTabs.get(connId) ?? []
      existingTabs.forEach((t) => destroyTab(t.tabId))
      globalTerminalTabs.delete(connId)
      globalActiveTabId.delete(connId)
      syncTabs(connId)
      onTerminalSessionChange?.(null)
    }
  }, [currentConn?.status])

  // ---- 切换连接时切换 DOM 显示 ----
  useEffect(() => {
    if (!wrapperRef.current) return

    // 先隐藏所有
    terminalStates.current.forEach((state) => {
      if (state.container.parentNode) state.container.parentNode.removeChild(state.container)
    })

    if (!currentConnectionId) return
    syncTabs(currentConnectionId)

    const activeId = globalActiveTabId.get(currentConnectionId)
    if (activeId && wrapperRef.current) {
      const state = terminalStates.current.get(activeId)
      if (state) {
        wrapperRef.current.appendChild(state.container)
        requestAnimationFrame(() => state.terminal.focus())
      }
    }

    const activeState = activeId ? terminalStates.current.get(activeId) : undefined
    onTerminalSessionChange?.(activeState?.session?.sessionId ?? null)
  }, [currentConnectionId])

  // ---- 挂载时恢复已有会话 ----
  useLayoutEffect(() => {
    if (!wrapperRef.current || !currentConnectionId) return
    const activeId = globalActiveTabId.get(currentConnectionId)
    if (!activeId) return
    const state = terminalStates.current.get(activeId)
    if (!state?.session) return
    if (!state.container.parentNode) {
      wrapperRef.current.appendChild(state.container)
      startPolling(state)
    }
    requestAnimationFrame(() => state.terminal.focus())
  }, [currentConnectionId, startPolling])

  // ---- 卸载清理 ----
  useEffect(() => {
    return () => {
      if (!keepSessionOnUnmount) {
        terminalStates.current.forEach((_, tabId) => destroyTab(tabId))
      } else {
        terminalStates.current.forEach((state) => {
          stopPolling(state)
          if (state.container.parentNode) state.container.parentNode.removeChild(state.container)
        })
      }
    }
  }, [destroyTab, stopPolling, keepSessionOnUnmount])

  // ---- 搜索 ----
  const handleSearch = useCallback((dir: 'next' | 'prev') => {
    if (!currentConnectionId) return
    const activeId = globalActiveTabId.get(currentConnectionId)
    if (!activeId) return
    const state = terminalStates.current.get(activeId)
    if (!state) return
    const deco = { matchBackground: '#fbbf2450', matchBorder: '#fbbf24', matchOverviewRuler: '#fbbf24', activeMatchColorOverviewRuler: '#f59e0b' }
    if (dir === 'next') {
      state.searchAddon.findNext(searchQuery, { caseSensitive: false, decorations: deco })
    } else {
      state.searchAddon.findPrevious(searchQuery, { caseSensitive: false, decorations: deco })
    }
  }, [currentConnectionId, searchQuery])

  useEffect(() => {
    if (searchQuery) handleSearch('next')
  }, [searchQuery])

  // ---- 快照导出 ----
  const handleSnapshot = useCallback(() => {
    if (!currentConnectionId) return
    const activeId = globalActiveTabId.get(currentConnectionId)
    if (!activeId) return
    const state = terminalStates.current.get(activeId)
    if (!state) return
    const lines: string[] = []
    const buffer = state.terminal.buffer.active
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i)
      if (line) lines.push(line.translateToString(true))
    }
    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `terminal-snapshot-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [currentConnectionId])

  // ---- 录制控制 ----
  const handleToggleRecording = useCallback(async () => {
    if (!currentConnectionId) return
    const activeId = globalActiveTabId.get(currentConnectionId)
    if (!activeId) return
    const state = terminalStates.current.get(activeId)
    if (!state?.session) return

    if (!isRecording) {
      const res = await startRecording(state.session.sessionId, currentConnectionId)
      if (res.code === '0000' && res.data) {
        setRecordingId(res.data)
        setIsRecording(true)
      }
    } else if (recordingId) {
      await stopRecording(state.session.sessionId, recordingId)
      setIsRecording(false)
      setRecordingId(null)
    }
  }, [currentConnectionId, isRecording, recordingId])

  const handleShowRecordings = useCallback(async () => {
    if (!currentConnectionId) return
    const res = await listRecordings(currentConnectionId)
    if (res.code === '0000' && res.data) {
      setRecordings(res.data)
      setShowRecordingList(true)
    }
  }, [currentConnectionId])

  // ---- 危险命令确认 ----
  const handleDangerConfirm = useCallback((confirmed: boolean) => {
    const { tabId } = dangerDialog
    setDangerDialog((p) => ({ ...p, visible: false }))
    const state = terminalStates.current.get(tabId)
    if (!state) return
    state.pendingDangerConfirm = false
    if (confirmed && state.pendingEnter && state.session) {
      const enter = state.pendingEnter
      state.pendingEnter = null
      writeInput({ sessionId: state.session.sessionId, input: enter }).catch(() => {})
    } else {
      state.pendingEnter = null
      // 发 Ctrl+C 取消
      if (state.session) {
        writeInput({ sessionId: state.session.sessionId, input: '\x03' }).catch(() => {})
      }
    }
  }, [dangerDialog])

  // ---- 右键菜单 ----
  const handleAddToChat = useCallback(() => {
    if (contextMenu.selectedText) {
      addInputTag({ label: contextMenu.selectedText.slice(0, 20) + (contextMenu.selectedText.length > 20 ? '...' : ''), fullContent: contextMenu.selectedText, type: 'terminal-selection' })
    }
    setContextMenu((p) => ({ ...p, visible: false }))
  }, [contextMenu.selectedText, addInputTag])

  const handleCopy = useCallback(() => {
    if (contextMenu.selectedText) navigator.clipboard.writeText(contextMenu.selectedText)
    setContextMenu((p) => ({ ...p, visible: false }))
  }, [contextMenu.selectedText])

  useEffect(() => {
    if (!contextMenu.visible) return
    const hide = () => setContextMenu((p) => ({ ...p, visible: false }))
    document.addEventListener('click', hide)
    return () => document.removeEventListener('click', hide)
  }, [contextMenu.visible])

  // ---- 重新连接 ----
  const handleReconnect = useCallback((tabId: string, connectionId: string) => {
    destroyTab(tabId)
    openTerminalSession(tabId, connectionId)
  }, [destroyTab, openTerminalSession])

  // ---- 当前活跃 tab 的状态 ----
  const currentActiveTabId = currentConnectionId ? (globalActiveTabId.get(currentConnectionId) ?? null) : null
  const currentState = currentActiveTabId ? terminalStates.current.get(currentActiveTabId) : undefined

  if (!currentConn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-w-0" style={{ backgroundColor: colors.bgPrimary }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🖥️</div>
          <h2 className="text-lg font-medium mb-2" style={{ color: colors.text }}>未连接 SSH 服务器</h2>
          <p className="text-sm mb-6" style={{ color: colors.textDim }}>请在左侧选择或添加 SSH 连接</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-w-0 relative" style={{ backgroundColor: colors.bgPrimary }}>
      {/* ===== 工具栏 ===== */}
      <div className="h-9 flex items-center px-2 border-b flex-shrink-0 gap-1" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
        {/* 标签页列表 */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const tabState = terminalStates.current.get(tab.tabId)
            const isActive = tab.tabId === currentActiveTabId
            return (
              <button
                key={tab.tabId}
                onClick={() => { if (!isActive) activateTab(tab.tabId, currentConn.id) }}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] flex-shrink-0 transition-colors"
                style={{
                  backgroundColor: isActive ? colors.bgPrimary : 'transparent',
                  color: isActive ? colors.text : colors.textDim,
                  border: `1px solid ${isActive ? colors.border : 'transparent'}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tabState?.disconnected ? colors.red : (tabState?.session ? colors.green : colors.yellow) }} />
                <span className="max-w-[80px] truncate">{tab.label}</span>
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.tabId, currentConn.id) }}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 flex-shrink-0 leading-none"
                    style={{ color: colors.textDim }}
                  >×</span>
                )}
              </button>
            )
          })}
          {/* 新建 tab 按钮 */}
          {isConnected && (
            <button
              onClick={() => {
                const tabId = createNewTab(currentConn.id)
                syncTabs(currentConn.id)
                openTerminalSession(tabId, currentConn.id).then(() => activateTab(tabId, currentConn.id))
              }}
              className="flex-shrink-0 px-2 py-0.5 rounded hover:bg-white/10 transition-colors text-[13px] leading-none"
              style={{ color: colors.textDim }}
              title="新建终端标签"
            >+</button>
          )}
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isConnected && !currentState?.disconnected && (
            <>
              {/* 搜索 */}
              <button onClick={() => setShowSearch(!showSearch)} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: showSearch ? colors.accent : colors.textDim }} title="搜索 (Ctrl+F)">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </button>

              {/* 命令历史 */}
              <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: showHistory ? colors.accent : colors.textDim }} title="命令历史">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-4.5L1 4v5h5L3.5 6.5"/>
                </svg>
              </button>

              {/* 快照 */}
              <button onClick={handleSnapshot} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: colors.textDim }} title="导出终端快照(.txt)">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>

              {/* 录制 */}
              <button onClick={handleToggleRecording} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: isRecording ? colors.red : colors.textDim }} title={isRecording ? '停止录制' : '开始录制'}>
                {isRecording
                  ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>}
              </button>

              {/* 录制列表 */}
              <button onClick={handleShowRecordings} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: colors.textDim }} title="查看录制列表">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </button>

              {/* 清屏 */}
              <button onClick={() => currentState?.terminal.clear()} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: colors.textDim }} title="清屏">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>

              {/* 命令辅助 */}
              <button onClick={() => setShowCommandSidebar(!showCommandSidebar)} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: showCommandSidebar ? colors.accent : colors.textDim }} title="命令辅助">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 17l6-6-6-6M12 19h8"/>
                </svg>
              </button>

              {/* 断开 */}
              <button onClick={async () => { await disconnect(currentConn.id); currentActiveTabId && destroyTab(currentActiveTabId) }} className="p-1.5 rounded hover:bg-white/10 transition-colors" style={{ color: colors.textDim }} title="断开连接">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </>
          )}
          {currentState?.disconnected && (
            <button onClick={() => currentActiveTabId && handleReconnect(currentActiveTabId, currentConn.id)} className="px-2 py-1 rounded text-[11px] font-medium transition-colors" style={{ backgroundColor: colors.green, color: '#ffffff' }}>
              重新连接
            </button>
          )}
        </div>
      </div>

      {/* ===== 搜索栏 ===== */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(e.shiftKey ? 'prev' : 'next')
              if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') }
            }}
            placeholder="搜索终端内容..."
            className="flex-1 bg-transparent outline-none text-[12px]"
            style={{ color: colors.text }}
          />
          <button onClick={() => handleSearch('prev')} className="p-1 rounded hover:bg-white/10 text-[11px]" style={{ color: colors.textDim }}>↑</button>
          <button onClick={() => handleSearch('next')} className="p-1 rounded hover:bg-white/10 text-[11px]" style={{ color: colors.textDim }}>↓</button>
          <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="p-1 rounded hover:bg-white/10 text-[11px]" style={{ color: colors.textDim }}>✕</button>
        </div>
      )}

      {/* ===== 命令辅助侧边栏 ===== */}
      {showCommandSidebar && (
        <CommandSidebar
          categories={COMMAND_CATEGORIES}
          expandedCategory={expandedCategory}
          onToggleCategory={(name) => setExpandedCategory(name)}
          onSelectCommand={(cmd) => {
            if (!currentActiveTabId) return
            const state = terminalStates.current.get(currentActiveTabId)
            if (!state?.terminal) return
            let finalCmd = cmd
            if (currentConn.username !== 'root') {
              const noSudo = ['cd', 'pwd', 'ls', 'echo', 'cat', 'exit', 'clear', 'history']
              if (!cmd.startsWith('sudo') && !noSudo.includes(cmd.trim().split(' ')[0])) finalCmd = `sudo ${cmd}`
            }
            state.terminal.paste(finalCmd)
            state.terminal.focus()
          }}
          colors={colors}
          isRoot={currentConn.username === 'root'}
        />
      )}

      {/* ===== 终端容器 ===== */}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        <div ref={wrapperRef} className="absolute inset-0" />

        {/* 非 CONNECTED 状态遮罩 */}
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
                <button onClick={() => connect(currentConn.id)} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: colors.accent, color: '#ffffff' }}>重试连接</button>
              </div>
            )}
            {currentConn.status === ConnectionStatus.DISCONNECTED && (
              <div className="text-center">
                <div className="text-6xl mb-4">🔌</div>
                <h2 className="text-lg font-medium mb-2" style={{ color: colors.text }}>{currentConn.name}</h2>
                <p className="text-sm mb-2" style={{ color: colors.textDim }}>{currentConn.username}@{currentConn.host}:{currentConn.port}</p>
                <button onClick={() => connect(currentConn.id)} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: colors.accent, color: '#ffffff' }}>连接服务器</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 断连提示 ===== */}
      {currentState?.disconnected && (
        <div className="p-3 border-t flex items-center justify-between" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
          <span className="text-xs" style={{ color: colors.red }}>⚠️ 终端连接已断开</span>
          <button onClick={() => currentActiveTabId && handleReconnect(currentActiveTabId, currentConn.id)} className="px-3 py-1 rounded text-xs font-medium" style={{ backgroundColor: colors.accent, color: '#ffffff' }}>重新连接</button>
        </div>
      )}

      {/* ===== 右键菜单 ===== */}
      {contextMenu.visible && (
        <div className="fixed z-50 rounded-lg py-1 shadow-lg border" style={{ left: contextMenu.pos.x, top: contextMenu.pos.y, backgroundColor: colors.bgPrimary, borderColor: colors.border, minWidth: '140px' }}>
          <button onClick={handleAddToChat} className="w-full px-3 py-2 text-left text-[12px] hover:bg-black/5 flex items-center gap-2" style={{ color: colors.text }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            添加到对话
          </button>
          <button onClick={handleCopy} className="w-full px-3 py-2 text-left text-[12px] hover:bg-black/5 flex items-center gap-2" style={{ color: colors.text }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            复制
          </button>
        </div>
      )}

      {/* ===== 命令历史面板 ===== */}
      {showHistory && (
        <CommandHistoryPanel
          history={historyList}
          colors={colors}
          onClose={() => setShowHistory(false)}
          onInsert={(cmd) => {
            if (!currentActiveTabId) return
            const state = terminalStates.current.get(currentActiveTabId)
            state?.terminal.paste(cmd)
            state?.terminal.focus()
          }}
          onExecute={(cmd) => {
            if (!currentActiveTabId) return
            const state = terminalStates.current.get(currentActiveTabId)
            if (state?.session) {
              writeInput({ sessionId: state.session.sessionId, input: cmd + '\r' }).catch(() => {})
            }
            state?.terminal.focus()
          }}
        />
      )}

      {/* ===== 危险命令确认弹窗 ===== */}
      {dangerDialog.visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl border" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.red + '60' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚠️</span>
              <h3 className="font-semibold" style={{ color: colors.red }}>危险命令警告</h3>
            </div>
            <p className="text-sm mb-2" style={{ color: colors.textDim }}>{dangerDialog.warning}</p>
            <div className="rounded px-3 py-2 mb-4 font-mono text-sm" style={{ backgroundColor: colors.bgPrimary, color: colors.text }}>
              {dangerDialog.command}
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleDangerConfirm(false)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: colors.bgPrimary, color: colors.text, border: `1px solid ${colors.border}` }}>
                取消
              </button>
              <button onClick={() => handleDangerConfirm(true)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: colors.red, color: '#ffffff' }}>
                仍然执行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 录制列表弹窗 ===== */}
      {showRecordingList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="rounded-xl p-4 max-w-lg w-full mx-4 shadow-2xl border" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm" style={{ color: colors.text }}>终端录制列表</h3>
              <button onClick={() => setShowRecordingList(false)} className="p-1 rounded hover:bg-white/10" style={{ color: colors.textDim }}>✕</button>
            </div>
            {recordings.length === 0
              ? <p className="text-xs text-center py-4" style={{ color: colors.textDim }}>暂无录制</p>
              : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {recordings.map((r) => (
                    <div key={r.recordingId} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: colors.bgPrimary }}>
                      <div>
                        <div className="text-xs font-mono" style={{ color: colors.text }}>{r.recordingId.slice(0, 12)}...</div>
                        <div className="text-[10px]" style={{ color: colors.textDim }}>
                          {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}
                          {r.durationMs ? ` · ${(r.durationMs / 1000).toFixed(1)}s` : ''}
                          {' · '}{r.status === 0 ? '录制中' : r.status === 1 ? '已完成' : '已中断'}
                        </div>
                      </div>
                      {r.status === 1 && (
                        <button
                          onClick={() => { setPlaybackRecordingId(r.recordingId); setShowPlayback(true); setShowRecordingList(false) }}
                          className="px-2 py-1 rounded text-[11px]"
                          style={{ backgroundColor: colors.accent, color: '#fff' }}
                        >▶ 回放</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      {/* ===== 终端回放 ===== */}
      {showPlayback && playbackRecordingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
          <div className="w-full h-full max-w-5xl max-h-[90vh] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold" style={{ color: colors.text }}>终端回放</h3>
              <button onClick={() => setShowPlayback(false)} className="px-3 py-1 rounded text-xs" style={{ backgroundColor: colors.bgSecondary, color: colors.text }}>关闭</button>
            </div>
            <div className="flex-1 min-h-0">
              <TerminalPlayback recordingId={playbackRecordingId} colors={colors} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 命令历史面板 =====

function CommandHistoryPanel({
  history,
  colors,
  onClose,
  onInsert,
  onExecute,
}: {
  history: string[]
  colors: ReturnType<typeof useThemeStore.getState>['colors']
  onClose: () => void
  onInsert: (cmd: string) => void
  onExecute: (cmd: string) => void
}) {
  return (
    <div className="absolute right-0 top-9 bottom-0 w-72 border-l overflow-hidden flex flex-col z-20" style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}>
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
        <span className="text-xs font-medium" style={{ color: colors.text }}>命令历史 ({history.length})</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10" style={{ color: colors.textDim }}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {history.length === 0
          ? <p className="text-xs text-center py-4" style={{ color: colors.textDim }}>暂无命令历史</p>
          : [...history].reverse().map((cmd, idx) => (
            <div key={idx} className="group flex items-center px-3 py-2 hover:bg-white/5 gap-2" style={{ borderBottom: `1px solid ${colors.border}20` }}>
              <span className="flex-1 text-[11px] font-mono truncate" style={{ color: colors.text }} title={cmd}>{cmd}</span>
              <button onClick={() => onInsert(cmd)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-[10px]" style={{ color: colors.accent }} title="插入">插</button>
              <button onClick={() => onExecute(cmd)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-[10px]" style={{ color: colors.green }} title="执行">▶</button>
            </div>
          ))}
      </div>
    </div>
  )
}

// ===== 命令辅助侧边栏（保持原有逻辑） =====

function CommandSidebar({
  categories, expandedCategory, onToggleCategory, onSelectCommand, colors, isRoot,
}: {
  categories: CommandCategory[]
  expandedCategory: string | null
  onToggleCategory: (name: string | null) => void
  onSelectCommand: (cmd: string) => void
  colors: ReturnType<typeof useThemeStore.getState>['colors']
  isRoot: boolean
}) {
  const handleCopyCommand = (e: React.MouseEvent, cmd: string) => {
    e.stopPropagation()
    let finalCmd = cmd
    if (!isRoot) {
      const noSudo = ['cd', 'pwd', 'ls', 'echo', 'cat', 'exit', 'clear', 'history']
      if (!cmd.startsWith('sudo') && !noSudo.includes(cmd.trim().split(' ')[0])) finalCmd = `sudo ${cmd}`
    }
    navigator.clipboard.writeText(finalCmd)
  }

  const needsSudo = (cmd: string) => {
    if (isRoot || cmd.startsWith('sudo')) return false
    const noSudo = ['cd', 'pwd', 'ls', 'echo', 'cat', 'exit', 'clear', 'history']
    return !noSudo.includes(cmd.trim().split(' ')[0])
  }

  return (
    <div className="absolute right-0 top-9 bottom-0 w-80 border-l overflow-hidden flex flex-col z-20" style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }}>
      <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
        <span className="text-xs font-medium" style={{ color: colors.text }}>命令辅助</span>
        {!isRoot && (
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: colors.accent + '20', color: colors.accent }}>非 root，自动加 sudo</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {categories.map((category) => (
          <div key={category.name} className="mb-4">
            <button onClick={() => onToggleCategory(expandedCategory === category.name ? null : category.name)} className="w-full flex items-center justify-between px-3 py-2 rounded text-left mb-2" style={{ backgroundColor: colors.bgSecondary, color: colors.text }}>
              <span className="text-xs flex items-center gap-1.5">
                <span>{category.emoji}</span>
                <span className="font-medium">{category.name}</span>
                <span className="text-[10px]" style={{ color: colors.textDim }}>({category.commands.length})</span>
              </span>
              <span style={{ color: colors.textDim }}>{expandedCategory === category.name ? '▼' : '▶'}</span>
            </button>
            {expandedCategory === category.name && (
              <div className="space-y-2">
                {category.commands.map((cmdItem: CommandItem, index: number) => (
                  <div key={index} className="group">
                    <div className="flex items-center gap-2 px-3 py-3 rounded-lg cursor-pointer border hover:opacity-90 transition-all" style={{ backgroundColor: colors.bgPrimary, borderColor: colors.border }} onClick={() => onSelectCommand(cmdItem.command)}>
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-mono" style={{ backgroundColor: colors.bgSecondary, color: colors.textDim }}>{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-mono flex items-center gap-1.5 mb-1">
                          {needsSudo(cmdItem.command) && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: colors.green + '20', color: colors.green }}>sudo</span>}
                          <span style={{ color: colors.accent }}>{cmdItem.command}</span>
                        </div>
                        <div className="text-[10px] leading-relaxed" style={{ color: colors.textDim }}>{cmdItem.description}</div>
                      </div>
                      <button onClick={(e) => handleCopyCommand(e, cmdItem.command)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-white/10 flex-shrink-0" style={{ color: colors.textDim }} title="复制">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
