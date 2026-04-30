import { create } from 'zustand'
import type { AgentMessage } from '../types'

interface AgentStore {
  // 当前会话 ID
  currentSessionId: string | null
  // 会话历史
  sessions: Map<string, { id: string; name: string; messages: AgentMessage[]; createdAt: number }>
  // 输入框内容
  inputText: string
  // 是否等待响应
  isLoading: boolean

  // 设置当前会话
  setCurrentSession: (id: string | null) => void
  // 添加消息
  addMessage: (sessionId: string, message: AgentMessage) => void
  // 设置输入框内容
  setInputText: (text: string) => void
  // 设置加载状态
  setLoading: (loading: boolean) => void
  // 创建新会话
  createSession: (name?: string) => string
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  currentSessionId: null,
  sessions: new Map(),
  inputText: '',
  isLoading: false,

  setCurrentSession: (id) => set({ currentSessionId: id }),

  addMessage: (sessionId, message) =>
    set((state) => {
      const sessions = new Map(state.sessions)
      const session = sessions.get(sessionId)
      if (session) {
        sessions.set(sessionId, {
          ...session,
          messages: [...session.messages, message],
        })
      }
      return { sessions }
    }),

  setInputText: (text) => set({ inputText: text }),

  setLoading: (loading) => set({ isLoading: loading }),

  createSession: (name) => {
    const id = `session_${Date.now()}`
    const session = {
      id,
      name: name || `会话 ${get().sessions.size + 1}`,
      messages: [] as AgentMessage[],
      createdAt: Date.now(),
    }
    set((state) => {
      const sessions = new Map(state.sessions)
      sessions.set(id, session)
      return { sessions, currentSessionId: id }
    })
    return id
  },
}))
