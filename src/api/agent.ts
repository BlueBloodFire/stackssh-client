/**
 * 智能体 API
 */
import { get } from './request'

export interface AiAgentConfigDTO {
  agentId: string
  agentName: string
  agentDesc: string
}

/** 查询智能体列表 */
export async function queryAgentList(): Promise<AiAgentConfigDTO[]> {
  const res = await get<AiAgentConfigDTO[]>('/api/v1/query_ai_agent_config_list')
  if (res.code === '0000' && res.data) {
    return res.data
  }
  console.error('[agentApi] queryAgentList failed:', res.info)
  return []
}