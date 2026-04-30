// SSH 连接信息
export interface SSHConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  createdAt: number
}

// Agent 会话消息
export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// Agent 会话
export interface AgentSession {
  id: string
  name: string
  connectionId?: string
  messages: AgentMessage[]
  createdAt: number
}

// 服务器状态
export interface ServerStatus {
  connected: boolean
  url: string
  version?: string
}
