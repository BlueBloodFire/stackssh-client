import { useState, useEffect, useRef, useCallback } from 'react'
import { useThemeStore } from '../stores/themeStore'
import { listKnowledge, uploadKnowledge, deleteKnowledge } from '../api/knowledge'
import type { KnowledgeDocumentDTO } from '../api/knowledge'

interface Props {
  connectionId?: string | null
  agentId?: string | null
}

const STATUS_LABEL: Record<number, string> = { 0: '处理中', 1: '就绪', 2: '失败' }
const STATUS_COLOR_KEY: Record<number, string> = { 0: 'yellow', 1: 'green', 2: 'red' }

export function KnowledgeBase({ connectionId, agentId }: Props) {
  const { colors } = useThemeStore()
  const [docs, setDocs] = useState<KnowledgeDocumentDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [scopeGlobal, setScopeGlobal] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const effectiveConnectionId = scopeGlobal ? undefined : (connectionId ?? undefined)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await listKnowledge(effectiveConnectionId, agentId ?? undefined)
      if (res.code === '0000' && res.data) setDocs(res.data)
    } catch {
      // 静默失败
    }
  }, [effectiveConnectionId, agentId])

  // 初始加载 + scope 切换时重新加载
  useEffect(() => {
    setLoading(true)
    fetchDocs().finally(() => setLoading(false))
  }, [fetchDocs])

  // 有"处理中"文档时轮询
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 0)
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(fetchDocs, 2000)
    } else if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }
  }, [docs, fetchDocs])

  const handleUpload = async (file: File) => {
    if (!file.name.match(/\.(txt|md)$/i)) {
      setUploadError('仅支持 .txt / .md 文件')
      setTimeout(() => setUploadError(''), 3000)
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const res = await uploadKnowledge(file, effectiveConnectionId, agentId ?? undefined)
      if (res.code === '0000' && res.data) {
        setDocs(prev => [res.data!, ...prev])
      } else {
        setUploadError(res.info || '上传失败')
        setTimeout(() => setUploadError(''), 4000)
      }
    } catch (e: any) {
      setUploadError(e?.message || '上传失败')
      setTimeout(() => setUploadError(''), 4000)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    setDocs(prev => prev.filter(d => d.docId !== docId))
    try { await deleteKnowledge(docId) } catch { fetchDocs() }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  return (
    <div className="border-t mt-2 pt-2" style={{ borderColor: colors.border }}>
      {/* 标题行 */}
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: colors.textDim }}>知识库 (RAG)</span>
        <div className="flex items-center gap-1.5">
          {/* 全局/当前连接 切换 */}
          <button
            onClick={() => setScopeGlobal(v => !v)}
            className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
            style={{
              backgroundColor: scopeGlobal ? `${colors.accent}20` : colors.bgTertiary,
              color: scopeGlobal ? colors.accent : colors.textDim,
              border: `1px solid ${scopeGlobal ? colors.accent + '40' : colors.border}`,
            }}
            title={scopeGlobal ? '显示全局文档' : '显示当前连接文档'}
          >
            {scopeGlobal ? '全局' : '当前连接'}
          </button>
          {/* 上传按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors"
            style={{ backgroundColor: colors.bgTertiary, color: colors.textSecondary, border: `1px solid ${colors.border}` }}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            上传
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = '' } }}
          />
        </div>
      </div>

      {/* 错误提示 */}
      {uploadError && (
        <div className="mx-3 mb-2 px-2 py-1 rounded text-[11px]" style={{ backgroundColor: `${colors.red}15`, color: colors.red }}>
          {uploadError}
        </div>
      )}

      {/* 拖拽上传区 */}
      <div
        className="mx-3 mb-2 rounded border-2 border-dashed flex items-center justify-center py-2 transition-colors cursor-pointer"
        style={{
          borderColor: dragging ? colors.accent : `${colors.border}`,
          backgroundColor: dragging ? `${colors.accent}10` : 'transparent',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <span className="text-[11px] flex items-center gap-1.5" style={{ color: colors.accent }}>
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            上传中...
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: colors.textDim }}>
            拖拽或点击上传 .txt / .md
          </span>
        )}
      </div>

      {/* 文档列表 */}
      <div className="px-3 space-y-1 max-h-48 overflow-y-auto">
        {loading ? (
          <p className="text-[11px] py-1 text-center" style={{ color: colors.textDim }}>加载中...</p>
        ) : docs.length === 0 ? (
          <p className="text-[11px] py-1 text-center" style={{ color: colors.textDim }}>暂无知识库文档</p>
        ) : (
          docs.map(doc => {
            const statusColor = (colors as any)[STATUS_COLOR_KEY[doc.status]] || colors.textDim
            return (
              <div
                key={doc.docId}
                className="flex items-center justify-between px-2 py-1.5 rounded"
                style={{ backgroundColor: colors.bgPrimary, border: `1px solid ${colors.border}` }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* 状态徽章 */}
                  <span
                    className="text-[10px] px-1 py-0.5 rounded-sm shrink-0 font-medium"
                    style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                  >
                    {STATUS_LABEL[doc.status]}
                  </span>
                  {/* 文件名 */}
                  <span className="text-[11px] truncate" style={{ color: colors.text }} title={doc.name}>
                    {doc.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {doc.status === 1 && (
                    <span className="text-[10px]" style={{ color: colors.textDim }}>{doc.chunkCount}块</span>
                  )}
                  <button
                    onClick={() => handleDelete(doc.docId)}
                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-red-500/10 transition-colors"
                    style={{ color: colors.textDim }}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
