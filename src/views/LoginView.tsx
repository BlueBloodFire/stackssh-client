import { useState } from 'react'
import { login, register } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'

type Mode = 'login' | 'register'

export function LoginView() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: storeLogin } = useAuthStore()
  const { currentTheme, colors } = useThemeStore()
  const isLight = currentTheme === 'light'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('请填写用户名和密码')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await login(username.trim(), password)
        if (res.code !== '0000' || !res.data) {
          setError(res.info || '登录失败')
          return
        }
        storeLogin(res.data.token, res.data.userId, res.data.username)
      } else {
        const res = await register(username.trim(), password)
        if (res.code !== '0000') {
          setError(res.info || '注册失败')
          return
        }
        const loginRes = await login(username.trim(), password)
        if (loginRes.code !== '0000' || !loginRes.data) {
          setError('注册成功，请手动登录')
          setMode('login')
          return
        }
        storeLogin(loginRes.data.token, loginRes.data.userId, loginRes.data.username)
      }
    } catch {
      setError('网络错误，请检查服务端是否启动')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="w-screen h-screen flex items-center justify-center"
      style={{
        background: isLight
          ? `radial-gradient(circle at top left, ${colors.accentSoft}, transparent 30%), linear-gradient(180deg, #f6f8fa 0%, #eef2f7 100%)`
          : `radial-gradient(circle at top left, ${colors.accentSoft}, transparent 28%), radial-gradient(circle at bottom right, rgba(255,255,255,0.04), transparent 18%), linear-gradient(180deg, ${colors.bgTitleBar} 0%, ${colors.bgPrimary} 100%)`,
      }}
    >
      <div
        className="w-[430px] rounded-[28px] border p-9"
        style={{
          backgroundColor: isLight ? '#ffffff' : colors.bgSecondary,
          borderColor: colors.border,
          boxShadow: isLight
            ? '0 18px 36px rgba(15,23,42,0.10)'
            : '0 24px 52px rgba(0,0,0,0.32)',
        }}
      >
        <div className="mb-7">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${colors.accent}, ${isLight ? '#0550ae' : '#2563eb'})`,
                boxShadow: `0 12px 24px ${colors.accentSoft}`,
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </div>
            <span className="text-[22px] font-semibold tracking-tight" style={{ color: isLight ? '#18181b' : colors.text }}>StackSSH</span>
          </div>
          <p className="text-[15px] ml-[56px]" style={{ color: isLight ? '#6e7781' : colors.textDim }}>AI SSH 智能终端与远程执行工作台</p>
          <p className="text-[13px] mt-2 leading-6" style={{ color: isLight ? '#6e7781' : colors.textSecondary }}>
            让 AI 对话、终端执行、文件操作与 Git 协作在同一个工作台里闭环。
          </p>
        </div>

        <div
          className="flex gap-1 mb-7 p-1 rounded-xl"
          style={{ backgroundColor: isLight ? '#f3f4f6' : colors.bgPrimary, border: `1px solid ${colors.border}` }}
        >
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              className="flex-1 py-2 text-[15px] font-medium rounded-lg transition-all duration-150"
              style={{
                backgroundColor: mode === m ? (isLight ? '#ffffff' : colors.bgSecondary) : 'transparent',
                color: mode === m ? (isLight ? '#18181b' : colors.text) : (isLight ? '#71717a' : colors.textDim),
                boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
              onClick={() => { setMode(m); setError('') }}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] mb-2 font-medium" style={{ color: isLight ? '#52525b' : colors.textSecondary }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl text-[14px] outline-none border transition-colors"
              style={{
                backgroundColor: isLight ? '#ffffff' : colors.bgInput,
                borderColor: colors.border,
                color: isLight ? '#18181b' : colors.text,
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.accent)}
              onBlur={(e) => (e.target.style.borderColor = colors.border)}
            />
          </div>

          <div>
            <label className="block text-[13px] mb-2 font-medium" style={{ color: isLight ? '#52525b' : colors.textSecondary }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-3.5 py-2.5 rounded-xl text-[14px] outline-none border transition-colors"
              style={{
                backgroundColor: isLight ? '#ffffff' : colors.bgInput,
                borderColor: colors.border,
                color: isLight ? '#18181b' : colors.text,
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.accent)}
              onBlur={(e) => (e.target.style.borderColor = colors.border)}
            />
          </div>

          {error && (
            <div
              className="px-3.5 py-2.5 rounded-xl text-[13px]"
              style={{ backgroundColor: `${colors.red}14`, color: colors.red, border: `1px solid ${colors.red}44` }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-[15px] font-medium transition-opacity"
            style={{
              background: `linear-gradient(135deg, ${colors.accent}, ${isLight ? '#0550ae' : '#2563eb'})`,
              color: '#ffffff',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="mt-5 text-center text-[13px]" style={{ color: isLight ? '#a1a1aa' : colors.textDim }}>
            没有账号？{' '}
            <button
              className="font-medium"
              style={{ color: colors.accent }}
              onClick={() => { setMode('register'); setError('') }}
            >
              立即注册
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
