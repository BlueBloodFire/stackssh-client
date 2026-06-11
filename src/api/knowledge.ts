import { get, post, del, postFormData } from './request'

export interface KnowledgeDocumentDTO {
  docId: string
  connectionId: string | null
  agentId: string | null
  name: string
  fileType: string
  /** 0=处理中 1=就绪 2=失败 */
  status: number
  chunkCount: number
  createdAt: string
}

export function listKnowledge(connectionId?: string, agentId?: string) {
  const params: Record<string, string> = {}
  if (connectionId) params.connectionId = connectionId
  if (agentId) params.agentId = agentId
  return get<KnowledgeDocumentDTO[]>('/api/v1/knowledge/list', params)
}

export function uploadKnowledge(file: File, connectionId?: string, agentId?: string) {
  const form = new FormData()
  form.append('file', file)
  if (connectionId) form.append('connectionId', connectionId)
  if (agentId) form.append('agentId', agentId)
  return postFormData<KnowledgeDocumentDTO>('/api/v1/knowledge/upload', form)
}

export function deleteKnowledge(docId: string) {
  return del<void>(`/api/v1/knowledge/${docId}`)
}

export function searchKnowledge(query: string, connectionId?: string, topK = 3) {
  return post<string[]>('/api/v1/knowledge/search', { query, connectionId, topK })
}
