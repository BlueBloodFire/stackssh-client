import { useState } from 'react'
import { useThemeStore, themes, type ThemeName } from '../stores/themeStore'

interface SettingsProps {
  open: boolean
  onClose: () => void
}

export function Settings({ open, onClose }: SettingsProps) {
  const { currentTheme, setTheme } = useThemeStore()
  const [section, setSection] = useState<'general' | 'appearance' | 'terminal' | 'about'>('general')

  if (!open) return null

  const { colors } = themes[currentTheme]
  const themeList = (Object.entries(themes) as [ThemeName, typeof themes[ThemeName]][])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="w-[640px] max-h-[75vh] rounded-xl shadow-2xl flex overflow-hidden relative"
        style={{ backgroundColor: colors.bgSecondary, border: `1px solid ${colors.border}` }}
      >
        {/* 关闭 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-white/10 transition-colors z-10"
          style={{ color: colors.textDim }}
        >
          ✕
        </button>

        {/* 左侧导航 */}
        <div className="w-40 p-3 border-r flex flex-col gap-0.5" style={{ borderColor: colors.border }}>
          {([
            { id: 'general' as const, label: '通用', icon: '⚙️' },
            { id: 'appearance' as const, label: '外观', icon: '🎨' },
            { id: 'terminal' as const, label: '终端', icon: '💻' },
            { id: 'about' as const, label: '关于', icon: 'ℹ️' },
          ]).map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-colors"
              style={{
                backgroundColor: section === item.id ? colors.accentSoft : 'transparent',
                color: section === item.id ? colors.accent : colors.textSecondary,
              }}
            >
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 p-5 overflow-y-auto">
          {section === 'general' && (
            <div>
              <h2 className="text-sm font-medium mb-4" style={{ color: colors.text }}>通用设置</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: colors.textDim }}>服务端地址</label>
                  <input
                    type="text"
                    defaultValue="http://localhost:8090"
                    className="w-full px-3 py-1.5 rounded-md text-xs outline-none"
                    style={{ backgroundColor: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: colors.textDim }}>语言</label>
                  <select className="w-full px-3 py-1.5 rounded-md text-xs outline-none" style={{ backgroundColor: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.text }}>
                    <option>简体中文</option><option>English</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div>
              <h2 className="text-sm font-medium mb-4" style={{ color: colors.text }}>外观设置</h2>
              <div className="grid grid-cols-2 gap-2">
                {themeList.map(([name, config]) => (
                  <button
                    key={name}
                    onClick={() => setTheme(name)}
                    className="p-3 rounded-lg text-left transition-all border"
                    style={{
                      backgroundColor: config.colors.bgPrimary,
                      borderColor: currentTheme === name ? config.colors.accent : config.colors.border,
                      borderWidth: 2,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex gap-1">
                        {[config.colors.bgPrimary, config.colors.bgSecondary, config.colors.accent, config.colors.green].map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs font-medium" style={{ color: config.colors.text }}>{config.label}</span>
                    {currentTheme === name && (
                      <span className="ml-1.5 text-[10px]" style={{ color: config.colors.accent }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {section === 'terminal' && (
            <div>
              <h2 className="text-sm font-medium mb-4" style={{ color: colors.text }}>终端设置</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: colors.textDim }}>字体</label>
                  <select className="w-full px-3 py-1.5 rounded-md text-xs outline-none" style={{ backgroundColor: colors.bgInput, border: `1px solid ${colors.border}`, color: colors.text }}>
                    <option>JetBrains Mono</option><option>Fira Code</option><option>Menlo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: colors.textDim }}>字号</label>
                  <input type="range" min="10" max="24" defaultValue="13" className="w-full" />
                </div>
              </div>
            </div>
          )}

          {section === 'about' && (
            <div className="flex flex-col items-center py-6">
              <img src="/logo.png" alt="WaLiSSH" className="w-16 h-16 rounded-xl mb-3" />
              <h3 className="text-sm font-semibold mb-1" style={{ color: colors.text }}>WaLiSSH</h3>
              <p className="text-xs mb-4" style={{ color: colors.textDim }}>v0.1.0 · AI + SSH 智能终端</p>
              <div className="w-full p-3 rounded-lg text-xs space-y-1.5" style={{ backgroundColor: colors.bgInput }}>
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
    </div>
  )
}
