import { useState, useEffect, useCallback, useRef } from 'react'
import { useThemeStore, themes, type ThemeName } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'
import { getToken } from '../stores/authStore'

interface SettingsProps {
  open: boolean
  onClose: () => void
}

type Section = 'general' | 'appearance' | 'terminal' | 'about'

export function Settings({ open, onClose }: SettingsProps) {
  const { currentTheme, setTheme } = useThemeStore()
  const { serverUrl, setServerUrl } = useConnectionStore()

  const [inputUrl, setInputUrl] = useState(serverUrl)
  const [inputLang, setInputLang] = useState('简体中文')
  const [inputFont, setInputFont] = useState('JetBrains Mono')
  const [inputFontSize, setInputFontSize] = useState(13)
  const [section, setSection] = useState<Section>('general')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle')

  const dialogRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 960, h: 640 })
  const dragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  useEffect(() => { setInputUrl(serverUrl) }, [serverUrl])

  const hasChanges = inputUrl.trim().replace(/\/+$/, '') !== serverUrl

  const handleTest = useCallback(async () => {
    const trimmed = inputUrl.trim().replace(/\/+$/, '')
    if (!trimmed) return
    setTestStatus('testing')
    try {
      const token = getToken()
      const res = await fetch(`${trimmed}/api/v1/ssh/connection_list?userId=default`, {
        signal: AbortSignal.timeout(8000),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      setTestStatus(json.code === '0000' ? 'success' : 'fail')
    } catch {
      setTestStatus('fail')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
  }, [inputUrl])

  const handleSave = useCallback(() => {
    const trimmed = inputUrl.trim().replace(/\/+$/, '')
    if (trimmed) setServerUrl(trimmed)
  }, [inputUrl, setServerUrl])

  const handleCancel = useCallback(() => {
    setInputUrl(serverUrl)
    onClose()
  }, [serverUrl, onClose])

  const handleSaveAndClose = useCallback(() => {
    handleSave()
    onClose()
  }, [handleSave, onClose])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const nw = Math.max(700, dragStart.current.w + ev.clientX - dragStart.current.x)
      const nh = Math.max(460, dragStart.current.h + ev.clientY - dragStart.current.y)
      setSize({ w: nw, h: nh })
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [size])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, handleCancel])

  if (!open) return null

  const { colors } = themes[currentTheme]
  const themeList = Object.entries(themes) as [ThemeName, typeof themes[ThemeName]][]
  const themeDescriptions: Record<ThemeName, string> = {
    dark: '桌面工具灰调，适合作为默认产品风格',
    light: 'GitHub 白风格，适合演示与轻量浏览',
    midnight: 'GitHub 黑风格，终端与代码阅读更稳定',
  }

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'general', label: '通用', icon: '⚙️' },
    { id: 'appearance', label: '外观', icon: '🎨' },
    { id: 'terminal', label: '终端', icon: '🖇' },
    { id: 'about', label: '关于', icon: 'ℹ️' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div
        ref={dialogRef}
        className="rounded-[22px] shadow-2xl flex flex-col overflow-hidden relative select-none"
        style={{
          backgroundColor: colors.bgSecondary,
          border: `1px solid ${colors.border}`,
          width: size.w,
          height: size.h,
          minWidth: 700,
          minHeight: 460,
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ backgroundColor: colors.bgTitleBar, borderBottom: `1px solid ${colors.border}` }}
        >
          <span className="text-[14px] font-semibold" style={{ color: colors.text }}>设置</span>
          <button
            onClick={handleCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
            style={{ color: colors.textDim }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.bgHover }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div
            className="w-56 p-4 border-r flex flex-col gap-1 shrink-0"
            style={{ borderColor: colors.border, backgroundColor: colors.bgPrimary }}
          >
            {sections.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] text-left transition-colors"
                style={{
                  backgroundColor: section === item.id ? colors.accentSoft : 'transparent',
                  color: section === item.id ? colors.accent : colors.textSecondary,
                  fontWeight: section === item.id ? 600 : 400,
                }}
              >
                <span className="text-[15px]">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-8 overflow-y-auto">
            {section === 'general' && (
              <div className="space-y-6">
                <h2 className="text-[15px] font-semibold" style={{ color: colors.text }}>通用设置</h2>

                <div>
                  <label className="block text-[13px] mb-2" style={{ color: colors.textDim }}>服务端地址</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="http://localhost:8091"
                      className="flex-1 px-3.5 py-2 rounded-xl text-[13px] outline-none transition-colors"
                      style={{
                        backgroundColor: colors.bgInput,
                        border: `1px solid ${inputUrl.trim().replace(/\/+$/, '') !== serverUrl ? colors.accent : colors.border}`,
                        color: colors.text,
                      }}
                    />
                    <button
                      onClick={handleTest}
                      disabled={testStatus === 'testing'}
                      className="px-4 py-2 rounded-xl text-[13px] font-medium transition-colors whitespace-nowrap"
                      style={{
                        backgroundColor: colors.bgTertiary,
                        border: `1px solid ${colors.border}`,
                        color: testStatus === 'success' ? colors.green : testStatus === 'fail' ? colors.red : colors.textSecondary,
                      }}
                    >
                      {testStatus === 'testing' ? '测试中...' : testStatus === 'success' ? '✓ 连接成功' : testStatus === 'fail' ? '✕ 连接失败' : '测试连接'}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[12px]" style={{ color: colors.textDim }}>后端 API 的完整地址，例如 http://localhost:8091</p>
                </div>

                <div>
                  <label className="block text-[13px] mb-2" style={{ color: colors.textDim }}>语言</label>
                  <select
                    value={inputLang}
                    onChange={(e) => setInputLang(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-[13px] outline-none"
                    style={{ backgroundColor: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.text }}
                  >
                    <option>简体中文</option>
                    <option>English</option>
                  </select>
                </div>
              </div>
            )}

            {section === 'appearance' && (
              <div className="space-y-6">
                <h2 className="text-[16px] font-semibold" style={{ color: colors.text }}>外观设置</h2>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  {themeList.map(([name, config]) => (
                    <button
                      key={name}
                      onClick={() => setTheme(name)}
                      className="p-4 rounded-2xl text-left transition-all border"
                      style={{
                        background: `linear-gradient(180deg, ${config.colors.bgSecondary}, ${config.colors.bgPrimary})`,
                        borderColor: currentTheme === name ? config.colors.accent : config.colors.border,
                        boxShadow: currentTheme === name ? `0 10px 24px ${config.colors.accentSoft}` : 'none',
                      }}
                    >
                      <div className="rounded-xl overflow-hidden border mb-3" style={{ borderColor: config.colors.border }}>
                        <div className="h-3" style={{ backgroundColor: config.colors.bgTitleBar }} />
                        <div className="flex h-16">
                          <div className="w-8 border-r" style={{ backgroundColor: config.colors.bgTertiary, borderColor: config.colors.border }} />
                          <div className="flex-1" style={{ backgroundColor: config.colors.bgPrimary }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        {[config.colors.bgPrimary, config.colors.bgSecondary, config.colors.accent, config.colors.green].map((c, i) => (
                          <div key={i} className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: c, borderColor: config.colors.border }} />
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-medium" style={{ color: config.colors.text }}>{config.label}</span>
                        {currentTheme === name && (
                          <span className="text-xs" style={{ color: config.colors.accent }}>✓</span>
                        )}
                      </div>
                      <p className="mt-2 text-[12px] leading-6" style={{ color: config.colors.textSecondary }}>
                        {themeDescriptions[name]}
                      </p>
                    </button>
                  ))}
                </div>
                <div
                  className="rounded-2xl p-5"
                  style={{
                    backgroundColor: colors.bgPrimary,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="text-[15px] font-semibold" style={{ color: colors.text }}>产品定位说明</h3>
                    <span
                      className="px-2.5 py-1 rounded-full text-[12px] font-medium"
                      style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
                    >
                      AI 主入口
                    </span>
                  </div>
                  <p className="text-[13px] leading-6" style={{ color: colors.textSecondary }}>
                    StackSSH 以 AI 对话为主入口，但不脱离 SSH。终端、文件与 Git 是执行底座；模型配置、RAG、MCP 与 Skills 是让 Agent 更会做事的能力层。
                  </p>
                </div>
              </div>
            )}

            {section === 'terminal' && (
              <div className="space-y-6">
                <h2 className="text-[15px] font-semibold" style={{ color: colors.text }}>终端设置</h2>

                <div>
                  <label className="block text-[13px] mb-2" style={{ color: colors.textDim }}>字体</label>
                  <select
                    value={inputFont}
                    onChange={(e) => setInputFont(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-[13px] outline-none"
                    style={{ backgroundColor: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.text }}
                  >
                    <option>JetBrains Mono</option>
                    <option>Fira Code</option>
                    <option>Menlo</option>
                    <option>Source Code Pro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] mb-2" style={{ color: colors.textDim }}>字号</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="10"
                      max="24"
                      value={inputFontSize}
                      onChange={(e) => setInputFontSize(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-[13px] w-8 text-right tabular-nums" style={{ color: colors.text }}>{inputFontSize}px</span>
                  </div>
                </div>
              </div>
            )}

            {section === 'about' && (
              <div className="flex flex-col items-center py-10">
                <img src="/logo.png" alt="StackSSH" className="w-20 h-20 rounded-xl mb-4" />
                <h3 className="text-lg font-semibold mb-1" style={{ color: colors.text }}>StackSSH</h3>
                <p className="text-[13px] mb-6" style={{ color: colors.textDim }}>v0.1.0 · AI + SSH 智能终端</p>
                <div className="w-full max-w-sm p-4 rounded-xl text-[13px] space-y-3" style={{ backgroundColor: colors.bgInput }}>
                  {[
                    ['前端', 'Tauri 2.0 + React 19'],
                    ['后端', 'Spring AI + Google ADK'],
                    ['构建', 'Vite 7 + TypeScript'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span style={{ color: colors.textDim }}>{k}</span>
                      <span style={{ color: colors.textSecondary }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-3 px-6 py-3.5 shrink-0"
          style={{ backgroundColor: colors.bgTitleBar, borderTop: `1px solid ${colors.border}` }}
        >
          <button
            onClick={handleCancel}
            className="px-5 py-2 rounded-xl text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: colors.bgTertiary,
              border: `1px solid ${colors.border}`,
              color: colors.textSecondary,
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-5 py-2 rounded-xl text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: hasChanges ? colors.bgTertiary : colors.bgInput,
              border: `1px solid ${colors.border}`,
              color: hasChanges ? colors.text : colors.textDim,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
            }}
          >
            保存
          </button>
          <button
            onClick={handleSaveAndClose}
            disabled={!hasChanges}
            className="px-5 py-2 rounded-xl text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: hasChanges ? colors.accent : colors.bgInput,
              color: hasChanges ? '#fff' : colors.textDim,
              cursor: hasChanges ? 'pointer' : 'not-allowed',
            }}
          >
            保存并关闭
          </button>
        </div>

        <div
          onMouseDown={onResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-0.5"
          style={{ color: colors.textDim }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <circle cx="8" cy="2" r="1" />
            <circle cx="8" cy="5" r="1" />
            <circle cx="5" cy="5" r="1" />
            <circle cx="8" cy="8" r="1" />
            <circle cx="5" cy="8" r="1" />
            <circle cx="2" cy="8" r="1" />
          </svg>
        </div>
      </div>
    </div>
  )
}
