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
        // 注册后自动登录
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
      style={{ backgroundColor: '#0d1117' }}
    >
      <div
        className="w-96 rounded-xl border p-8 shadow-2xl"
        style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold mb-1" style={{ color: '#58a6ff' }}>
            StackSSH
          </div>
          <div className="text-sm" style={{ color: '#8b949e' }}>
            AI SSH 智能终端
          </div>
        </div>

        {/* 模式切换 */}
        <div className="flex mb-6 rounded-lg overflow-hidden border" style={{ borderColor: '#30363d' }}>
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: mode === m ? '#21262d' : 'transparent',
                color: mode === m ? '#e6edf3' : '#8b949e',
              }}
              onClick={() => { setMode(m); setError('') }}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#8b949e' }}>
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
                backgroundColor: '#0d1117',
                borderColor: '#30363d',
                color: '#e6edf3',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#58a6ff')}
              onBlur={(e) => (e.target.style.borderColor = '#30363d')}
            />
          </div>

          <div>
            <label className="block text-xs mb-1.5 font-medium" style={{ color: '#8b949e' }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none border transition-colors"
              style={{
                backgroundColor: '#0d1117',
                borderColor: '#30363d',
                color: '#e6edf3',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#58a6ff')}
              onBlur={(e) => (e.target.style.borderColor = '#30363d')}
            />
          </div>

          {error && (
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ backgroundColor: '#3d1f1f', color: '#f85149', border: '1px solid #5a1e1e' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity"
            style={{
              backgroundColor: '#238636',
              color: '#ffffff',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="mt-4 text-center text-xs" style={{ color: '#8b949e' }}>
            没有账号？{' '}
            <button
              className="underline"
              style={{ color: '#58a6ff' }}
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
