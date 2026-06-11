import { useState } from 'react'
import { login, register } from '../api/auth'
import { useAuthStore } from '../stores/authStore'

type Mode = 'login' | 'register'

export function LoginView() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: storeLogin } = useAuthStore()

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
      style={{ backgroundColor: '#f5f6f8' }}
    >
      <div
        className="w-[380px] rounded-2xl border p-8"
        style={{
          backgroundColor: '#ffffff',
          borderColor: '#e4e4e7',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <div className="mb-7">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#2563eb' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
            </div>
            <span className="text-[18px] font-semibold tracking-tight" style={{ color: '#18181b' }}>StackSSH</span>
          </div>
          <p className="text-sm ml-[42px]" style={{ color: '#a1a1aa' }}>AI SSH 智能终端</p>
        </div>

        {/* 模式切换 */}
        <div
          className="flex gap-1 mb-6 p-1 rounded-xl"
          style={{ backgroundColor: '#f4f4f5' }}
        >
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              className="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all duration-150"
              style={{
                backgroundColor: mode === m ? '#ffffff' : 'transparent',
                color: mode === m ? '#18181b' : '#71717a',
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
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#52525b' }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border transition-colors"
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#e4e4e7',
                color: '#18181b',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
              onBlur={(e) => (e.target.style.borderColor = '#e4e4e7')}
            />
          </div>

          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#52525b' }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border transition-colors"
              style={{
                backgroundColor: '#ffffff',
                borderColor: '#e4e4e7',
                color: '#18181b',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
              onBlur={(e) => (e.target.style.borderColor = '#e4e4e7')}
            />
          </div>

          {error && (
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="mt-5 text-center text-xs" style={{ color: '#a1a1aa' }}>
            没有账号？{' '}
            <button
              className="font-medium"
              style={{ color: '#2563eb' }}
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
