import { useCallback, useEffect, useState } from 'react'
import { useThemeStore } from '../stores/themeStore'
import { useConnectionStore } from '../stores/connectionStore'
import { ConnectionStatus } from '../types'
import { openTerminal, execCommand, closeTerminal } from '../api/terminal'

/**
 * Git 版本分支管理面板
 * 通过专用终端会话在远程服务器执行 git 命令（不干扰用户可见终端）
 */

// connectionId -> 专用 git 会话 ID（模块级缓存，跨挂载复用）
const gitSessions = new Map<string, string>()

const REPO_PATH_KEY = 'stackssh_git_repo_path'

function loadRepoPath(connectionId: string): string {
  try {
    const all = JSON.parse(localStorage.getItem(REPO_PATH_KEY) || '{}')
    return all[connectionId] || ''
  } catch { return '' }
}

function saveRepoPath(connectionId: string, path: string) {
  try {
    const all = JSON.parse(localStorage.getItem(REPO_PATH_KEY) || '{}')
    all[connectionId] = path
    localStorage.setItem(REPO_PATH_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

interface GitStatus {
  branch: string
  tracking: string
  ahead: number
  behind: number
  modified: number
  untracked: number
  staged: number
}

interface GitCommit {
  hash: string
  message: string
}

async function ensureGitSession(connectionId: string): Promise<string> {
  const cached = gitSessions.get(connectionId)
  if (cached) return cached
  const res = await openTerminal({ connectionId, cols: 200, rows: 24 })
  if (res.code !== '0000' || !res.data) throw new Error(res.info || '无法打开 Git 会话')
  gitSessions.set(connectionId, res.data.sessionId)
  return res.data.sessionId
}

async function runGit(connectionId: string, command: string): Promise<string> {
  let sessionId = await ensureGitSession(connectionId)
  try {
    const res = await execCommand({ sessionId, command })
    if (res.code !== '0000') throw new Error(res.info || '命令执行失败')
    return res.data?.output ?? ''
  } catch (err) {
    // 会话可能已失效，重建一次再试
    gitSessions.delete(connectionId)
    sessionId = await ensureGitSession(connectionId)
    const res = await execCommand({ sessionId, command })
    if (res.code !== '0000') throw new Error(res.info || '命令执行失败')
    return res.data?.output ?? ''
  }
}

/** 解析 git status --porcelain -b 输出（容忍 shell echo/prompt 噪声行） */
function parseStatus(output: string): GitStatus | null {
  const lines = output.split('\n').map((l) => l.replace(/\r/g, ''))
  const headLine = lines.find((l) => l.startsWith('## '))
  if (!headLine) return null

  const status: GitStatus = { branch: '', tracking: '', ahead: 0, behind: 0, modified: 0, untracked: 0, staged: 0 }
  // ## main...origin/main [ahead 1, behind 2]
  const m = headLine.match(/^## ([^.\s]+)(?:\.\.\.(\S+))?(?:\s+\[(.+)\])?/)
  if (m) {
    status.branch = m[1]
    status.tracking = m[2] || ''
    if (m[3]) {
      const ahead = m[3].match(/ahead (\d+)/)
      const behind = m[3].match(/behind (\d+)/)
      if (ahead) status.ahead = parseInt(ahead[1])
      if (behind) status.behind = parseInt(behind[1])
    }
  }
  for (const line of lines) {
    if (line.startsWith('## ') || line.length < 3) continue
    const x = line[0]
    const y = line[1]
    if (x === '?' && y === '?') status.untracked++
    else if (/^[MADRCU]/.test(x)) status.staged++
    else if (/^[MADRCU]/.test(y)) status.modified++
  }
  return status
}

/** 解析 git branch 输出 */
function parseBranches(output: string): { current: string; branches: string[] } {
  const branches: string[] = []
  let current = ''
  for (const raw of output.split('\n')) {
    const line = raw.replace(/\r/g, '')
    const m = line.match(/^(\*?)\s+([\w\-./@]+)$/)
    if (!m) continue
    if (m[1] === '*') current = m[2]
    branches.push(m[2])
  }
  return { current, branches }
}

/** 解析 git log --oneline 输出 */
function parseLog(output: string): GitCommit[] {
  const commits: GitCommit[] = []
  for (const raw of output.split('\n')) {
    const line = raw.replace(/\r/g, '').trim()
    const m = line.match(/^([0-9a-f]{7,40})\s+(.+)$/)
    if (m) commits.push({ hash: m[1].slice(0, 7), message: m[2] })
  }
  return commits
}

export function GitPanel() {
  const { colors } = useThemeStore()
  const { connections, currentConnectionId } = useConnectionStore()
  const currentConn = connections.find((c) => c.id === currentConnectionId)
  const isConnected = currentConn?.status === ConnectionStatus.CONNECTED

  const [repoPath, setRepoPath] = useState('')
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [actionOutput, setActionOutput] = useState('')
  const [newBranchOpen, setNewBranchOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  // 切换连接时恢复保存的仓库路径
  useEffect(() => {
    if (currentConnectionId) {
      setRepoPath(loadRepoPath(currentConnectionId))
      setStatus(null)
      setBranches([])
      setCommits([])
      setError('')
      setActionOutput('')
    }
  }, [currentConnectionId])

  const refresh = useCallback(async (path?: string) => {
    const p = (path ?? repoPath).trim()
    if (!currentConnectionId || !p) return
    setLoading(true)
    setError('')
    try {
      const statusOut = await runGit(currentConnectionId, `git -C "${p}" status --porcelain -b 2>&1`)
      if (/not a git repository|fatal:/i.test(statusOut) && !statusOut.includes('## ')) {
        setError(`不是 Git 仓库或路径无效: ${p}`)
        setStatus(null)
        setBranches([])
        setCommits([])
        return
      }
      const parsed = parseStatus(statusOut)
      setStatus(parsed)

      const branchOut = await runGit(currentConnectionId, `git -C "${p}" branch 2>&1`)
      setBranches(parseBranches(branchOut).branches)

      const logOut = await runGit(currentConnectionId, `git -C "${p}" log --oneline -n 15 2>&1`)
      setCommits(parseLog(logOut))

      saveRepoPath(currentConnectionId, p)
    } catch (err: any) {
      setError(err.message || '执行失败')
    } finally {
      setLoading(false)
    }
  }, [currentConnectionId, repoPath])

  const runAction = useCallback(async (name: string, command: string) => {
    if (!currentConnectionId || !repoPath.trim()) return
    setActionLoading(name)
    setActionOutput('')
    setError('')
    try {
      const out = await runGit(currentConnectionId, command)
      setActionOutput(out.trim().slice(0, 2000))
      await refresh()
    } catch (err: any) {
      setError(err.message || '执行失败')
    } finally {
      setActionLoading(null)
    }
  }, [currentConnectionId, repoPath, refresh])

  const handleCheckout = (branch: string) => {
    if (branch === status?.branch) return
    runAction(`checkout-${branch}`, `git -C "${repoPath.trim()}" checkout "${branch}" 2>&1`)
  }

  const handleCreateBranch = () => {
    const name = newBranchName.trim()
    if (!name) return
    setNewBranchOpen(false)
    setNewBranchName('')
    runAction('create-branch', `git -C "${repoPath.trim()}" checkout -b "${name}" 2>&1`)
  }

  // 卸载时不关闭会话（模块级缓存复用）；连接断开时清缓存
  useEffect(() => {
    if (currentConnectionId && currentConn && currentConn.status !== ConnectionStatus.CONNECTED) {
      const sid = gitSessions.get(currentConnectionId)
      if (sid) {
        closeTerminal(sid).catch(() => {})
        gitSessions.delete(currentConnectionId)
      }
    }
  }, [currentConn?.status, currentConnectionId])

  if (!currentConn || !isConnected) {
    return (
      <div className="text-center py-10 px-4">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke={colors.textDim} strokeWidth="1.5">
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        <p className="text-[15px] mb-1 font-medium" style={{ color: colors.textSecondary }}>AI 协助的 Git 工作台</p>
        <p className="text-[13px]" style={{ color: colors.textDim }}>请先连接 SSH 服务器</p>
      </div>
    )
  }

  const btnStyle = {
    backgroundColor: colors.bgPrimary,
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
  }

  return (
    <div className="p-3 space-y-3">
      <div
        className="rounded-xl px-3.5 py-3"
        style={{ backgroundColor: colors.bgPrimary, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[14px] font-semibold" style={{ color: colors.text }}>远程仓库工作台</span>
        </div>
        <p className="text-[12px] leading-5" style={{ color: colors.textSecondary }}>
          这里不是独立 Git 客户端，而是面向远程仓库的协作面板。适合查看分支状态、拉取变更，并让 AI 结合终端上下文给出操作建议。
        </p>
      </div>

      {/* 仓库路径 */}
      <div>
        <label className="block text-[11px] mb-1.5 font-medium uppercase tracking-wider" style={{ color: colors.textDim }}>
          仓库路径
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') refresh() }}
            placeholder="/home/user/project"
            className="flex-1 min-w-0 text-[12px] font-mono px-2.5 py-2 rounded outline-none"
            style={{ backgroundColor: colors.bgInput, color: colors.text, border: `1px solid ${colors.border}` }}
          />
          <button
            onClick={() => refresh()}
            disabled={loading || !repoPath.trim()}
            className="px-3 py-2 rounded text-[12px] font-medium transition-colors disabled:opacity-50 flex-shrink-0"
            style={{ backgroundColor: colors.accent, color: '#fff' }}
          >
            {loading ? '加载中' : '加载'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[12px] px-2.5 py-2 rounded-xl" style={{ backgroundColor: `${colors.red}15`, color: colors.red, border: `1px solid ${colors.red}30` }}>
          {error}
        </div>
      )}

      {status && (
        <>
          {/* 当前分支 + 状态 */}
          <div className="rounded-lg px-3 py-2.5 space-y-1.5" style={{ backgroundColor: colors.bgPrimary, border: `1px solid ${colors.border}` }}>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.accent }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              <span className="text-[13px] font-semibold font-mono truncate" style={{ color: colors.text }}>{status.branch}</span>
              {(status.ahead > 0 || status.behind > 0) && (
                <span className="text-[11px] font-mono flex-shrink-0" style={{ color: colors.yellow }}>
                  {status.ahead > 0 && `↑${status.ahead}`}{status.behind > 0 && ` ↓${status.behind}`}
                </span>
              )}
            </div>
            {status.tracking && (
              <div className="text-[11px] font-mono pl-5 truncate" style={{ color: colors.textDim }}>跟踪 {status.tracking}</div>
            )}
            <div className="flex gap-3 pl-5 text-[11px]" style={{ color: colors.textDim }}>
              <span style={{ color: status.staged > 0 ? colors.green : undefined }}>暂存 {status.staged}</span>
              <span style={{ color: status.modified > 0 ? colors.yellow : undefined }}>修改 {status.modified}</span>
              <span style={{ color: status.untracked > 0 ? colors.accent : undefined }}>未跟踪 {status.untracked}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => runAction('pull', `git -C "${repoPath.trim()}" pull 2>&1`)} disabled={!!actionLoading} className="py-2 rounded text-[12px] transition-colors disabled:opacity-50" style={btnStyle}>
              {actionLoading === 'pull' ? '...' : 'Pull'}
            </button>
            <button onClick={() => runAction('fetch', `git -C "${repoPath.trim()}" fetch --all --prune 2>&1`)} disabled={!!actionLoading} className="py-2 rounded text-[12px] transition-colors disabled:opacity-50" style={btnStyle}>
              {actionLoading === 'fetch' ? '...' : 'Fetch'}
            </button>
            <button onClick={() => refresh()} disabled={loading || !!actionLoading} className="py-2 rounded text-[12px] transition-colors disabled:opacity-50" style={btnStyle}>
              刷新
            </button>
          </div>

          {actionOutput && (
            <pre className="text-[11px] font-mono px-2.5 py-2 rounded-xl overflow-x-auto max-h-32 overflow-y-auto" style={{ backgroundColor: colors.bgPrimary, color: colors.textSecondary, border: `1px solid ${colors.border}`, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {actionOutput}
            </pre>
          )}

          {/* 分支列表 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: colors.textDim }}>分支 ({branches.length})</span>
              <button
                onClick={() => setNewBranchOpen(!newBranchOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors"
                style={{ backgroundColor: newBranchOpen ? colors.accent : 'transparent', color: newBranchOpen ? '#fff' : colors.textSecondary, border: `1px solid ${newBranchOpen ? colors.accent : colors.border}` }}
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                新建
              </button>
            </div>

            {newBranchOpen && (
              <div className="flex gap-1.5 mb-2">
                <input
                  autoFocus
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBranch(); if (e.key === 'Escape') setNewBranchOpen(false) }}
                  placeholder="feature/my-branch"
                  className="flex-1 min-w-0 text-[12px] font-mono px-2.5 py-1.5 rounded outline-none"
                  style={{ backgroundColor: colors.bgInput, color: colors.text, border: `1px solid ${colors.border}` }}
                />
                <button onClick={handleCreateBranch} disabled={!newBranchName.trim()} className="px-3 py-1.5 rounded text-[11px] font-medium disabled:opacity-50 flex-shrink-0" style={{ backgroundColor: colors.accent, color: '#fff' }}>
                  创建
                </button>
              </div>
            )}

            <div className="space-y-0.5">
              {branches.map((branch) => {
                const isCurrent = branch === status.branch
                return (
                  <button
                    key={branch}
                    onClick={() => handleCheckout(branch)}
                    disabled={isCurrent || !!actionLoading}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors group disabled:cursor-default"
                    style={{ backgroundColor: isCurrent ? colors.accentSoft : 'transparent' }}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.backgroundColor = colors.bgHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isCurrent ? colors.accentSoft : 'transparent' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: isCurrent ? colors.accent : colors.border }} />
                    <span className="text-[12px] font-mono truncate flex-1" style={{ color: isCurrent ? colors.accent : colors.textSecondary, fontWeight: isCurrent ? 600 : 400 }}>
                      {branch}
                    </span>
                    {!isCurrent && (
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 flex-shrink-0" style={{ color: colors.textDim }}>
                        {actionLoading === `checkout-${branch}` ? '切换中...' : '切换'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 最近提交 */}
          {commits.length > 0 && (
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: colors.textDim }}>最近提交</span>
              <div className="space-y-0.5">
                {commits.map((c) => (
                  <div key={c.hash} className="flex items-baseline gap-2 px-2 py-1 rounded" title={c.message}>
                    <span className="text-[11px] font-mono flex-shrink-0" style={{ color: colors.accent }}>{c.hash}</span>
                    <span className="text-[12px] truncate" style={{ color: colors.textSecondary }}>{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
