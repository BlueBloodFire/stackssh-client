import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { getRecordingPlayback, type TerminalRecording, type TerminalRecordingEvent } from '../api/terminal'
import type { ThemeColors } from '../stores/themeStore'

interface Props {
  recordingId: string
  colors: ThemeColors
}

export function TerminalPlayback({ recordingId, colors }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [recording, setRecording] = useState<TerminalRecording | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)  // 0-100
  const [speed, setSpeed] = useState(1)
  const playingRef = useRef(false)
  const speedRef = useRef(1)

  // 初始化 xterm
  useEffect(() => {
    if (!containerRef.current) return
    const term = new Terminal({
      cursorBlink: false,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      scrollback: 100000,
      rows: 24,
      cols: 120,
      allowProposedApi: false,
      theme: {
        background: colors.bgPrimary ?? '#1e1e1e',
        foreground: colors.text ?? '#d4d4d4',
      },
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()
    termRef.current = term
    fitAddonRef.current = fitAddon

    return () => {
      term.dispose()
    }
  }, [])

  // 加载录制数据
  useEffect(() => {
    setLoading(true)
    setError(null)
    getRecordingPlayback(recordingId)
      .then((res) => {
        if (res.code === '0000' && res.data) {
          setRecording(res.data)
        } else {
          setError(res.info ?? '加载录制失败')
        }
      })
      .catch(() => setError('网络错误'))
      .finally(() => setLoading(false))
  }, [recordingId])

  // 播放逻辑
  const play = useCallback(() => {
    if (!recording?.events?.length || !termRef.current) return
    playingRef.current = true
    setIsPlaying(true)
    termRef.current.reset()

    const events = recording.events as TerminalRecordingEvent[]
    let idx = 0
    const total = events[events.length - 1]?.offsetMs ?? 1

    const scheduleNext = () => {
      if (!playingRef.current || idx >= events.length) {
        playingRef.current = false
        setIsPlaying(false)
        setProgress(100)
        return
      }
      const event = events[idx++]
      const text = atob(event.data)
      termRef.current!.write(text)
      setProgress(Math.round((event.offsetMs / total) * 100))

      if (idx < events.length) {
        const delay = (events[idx].offsetMs - event.offsetMs) / speedRef.current
        timerRef.current = setTimeout(scheduleNext, Math.max(0, delay))
      } else {
        playingRef.current = false
        setIsPlaying(false)
        setProgress(100)
      }
    }
    scheduleNext()
  }, [recording])

  const pause = useCallback(() => {
    playingRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsPlaying(false)
  }, [])

  const stop = useCallback(() => {
    pause()
    setProgress(0)
    termRef.current?.reset()
  }, [pause])

  const handleSpeedChange = (s: number) => {
    setSpeed(s)
    speedRef.current = s
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: colors.textDim }}>
        <span className="text-sm">加载录制数据中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: colors.red }}>
        <span className="text-sm">{error}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden border" style={{ borderColor: colors.border }}>
      {/* 终端显示区 */}
      <div ref={containerRef} className="flex-1 min-h-0 bg-black" />

      {/* 控制栏 */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-t" style={{ backgroundColor: colors.bgSecondary, borderColor: colors.border }}>
        {/* 播放/暂停/停止 */}
        <button
          onClick={isPlaying ? pause : play}
          className="px-3 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: colors.accent, color: '#fff' }}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button onClick={stop} className="px-3 py-1 rounded text-xs font-medium" style={{ backgroundColor: colors.bgPrimary, color: colors.text, border: `1px solid ${colors.border}` }}>
          ■ 停止
        </button>

        {/* 进度条 */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.bgPrimary }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: colors.accent }} />
          </div>
          <span className="text-[10px] w-8 text-right" style={{ color: colors.textDim }}>{progress}%</span>
        </div>

        {/* 速度 */}
        <div className="flex items-center gap-1">
          <span className="text-[10px]" style={{ color: colors.textDim }}>速度</span>
          {[0.5, 1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => handleSpeedChange(s)}
              className="px-1.5 py-0.5 rounded text-[10px]"
              style={{
                backgroundColor: speed === s ? colors.accent : colors.bgPrimary,
                color: speed === s ? '#fff' : colors.textDim,
                border: `1px solid ${colors.border}`,
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* 时长 */}
        {recording?.durationMs && (
          <span className="text-[10px]" style={{ color: colors.textDim }}>
            共 {(recording.durationMs / 1000).toFixed(1)}s · {recording.events?.length ?? 0} 帧
          </span>
        )}
      </div>
    </div>
  )
}
