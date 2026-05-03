import { create } from 'zustand'
import * as sshAgentApi from '../api/sshAgent'

/**
 * SSH 智能体会话绑定 Store
 * 
 * 核心功能：
 * 1. 管理智能体会话与 SSH 终端会话的绑定关系
 * 2. 自动绑定当前激活的 SSH 连接到智能体会话
 * 3. 支持手动添加服务器信息到对话上下文
 * 4. 支持从终端选中内容添加到对话
 */

interface SshAgentBinding {
  /** 智能体会话 ID */
  chatSessionId: string
  /** SSH 终端会话 ID */
  terminalSessionId: string
  /** 连接 ID */
  connectionId: string
  /** 连接名称 */
  connectionName: string
  /** 服务器信息 */
  serverInfo: {
    host: string
    port: number
    username: string
  }
  /** 绑定时间 */
  boundAt: number
}

interface TerminalSelection {
  /** 选中的文本 */
  text: string
  /** 来源终端会话 ID */
  terminalSessionId: string
  /** 选中时间 */
  selectedAt: number
}

interface SshAgentStore {
  // ===== 绑定状态 =====
  /** 当前激活的绑定 */
  activeBinding: SshAgentBinding | null
  /** 所有绑定记录（按 chatSessionId 索引） */
  bindings: Map<string, SshAgentBinding>
  /** 绑定加载中 */
  isBinding: boolean
  /** 绑定错误信息 */
  bindingError: string | null

  // ===== 终端选中内容 =====
  /** 当前选中的终端内容 */
  terminalSelection: TerminalSelection | null
  /** 是否显示添加到对话的提示 */
  showAddToChatHint: boolean

  // ===== 连接选择器 =====
  /** 是否显示连接选择器 */
  showConnectionSelector: boolean

  // ===== Actions =====
  /** 绑定终端到智能体会话 */
  bindTerminal: (
    chatSessionId: string,
    terminalSessionId: string,
    connectionInfo: {
      connectionId: string
      connectionName: string
      host: string
      port: number
      username: string
    }
  ) => Promise<boolean>

  /** 解绑终端 */
  unbindTerminal: (chatSessionId: string) => Promise<void>

  /** 查询绑定状态 */
  queryBinding: (chatSessionId: string) => Promise<SshAgentBinding | null>

  /** 设置当前激活的绑定 */
  setActiveBinding: (binding: SshAgentBinding | null) => void

  /** 设置终端选中内容 */
  setTerminalSelection: (selection: TerminalSelection | null) => void

  /** 清除终端选中内容 */
  clearTerminalSelection: () => void

  /** 显示连接选择器 */
  openConnectionSelector: () => void

  /** 关闭连接选择器 */
  closeConnectionSelector: () => void

  /** 清除绑定错误 */
  clearBindingError: () => void

  /** 获取当前会话的绑定 */
  getBindingByChatSession: (chatSessionId: string) => SshAgentBinding | undefined

  /** 格式化服务器信息为对话上下文 */
  formatServerContext: (binding: SshAgentBinding) => string
}

export const useSshAgentStore = create<SshAgentStore>((set, get) => ({
  // ===== State =====
  activeBinding: null,
  bindings: new Map(),
  isBinding: false,
  bindingError: null,
  terminalSelection: null,
  showAddToChatHint: false,
  showConnectionSelector: false,

  // ===== Actions =====
  bindTerminal: async (chatSessionId, terminalSessionId, connectionInfo) => {
    set({ isBinding: true, bindingError: null })
    try {
      const res = await sshAgentApi.bindTerminal({
        chatSessionId,
        terminalSessionId,
      })

      if (res.code === '0000' && res.data?.bound) {
        const binding: SshAgentBinding = {
          chatSessionId,
          terminalSessionId,
          connectionId: connectionInfo.connectionId,
          connectionName: connectionInfo.connectionName,
          serverInfo: {
            host: connectionInfo.host,
            port: connectionInfo.port,
            username: connectionInfo.username,
          },
          boundAt: Date.now(),
        }

        set((state) => {
          const bindings = new Map(state.bindings)
          bindings.set(chatSessionId, binding)
          return {
            bindings,
            activeBinding: binding,
            isBinding: false,
          }
        })

        return true
      }

      set({
        bindingError: res.info || '绑定失败',
        isBinding: false,
      })
      return false
    } catch (err) {
      set({
        bindingError: err instanceof Error ? err.message : '网络错误',
        isBinding: false,
      })
      return false
    }
  },

  unbindTerminal: async (chatSessionId) => {
    try {
      await sshAgentApi.unbindTerminal(chatSessionId)
      set((state) => {
        const bindings = new Map(state.bindings)
        bindings.delete(chatSessionId)
        return {
          bindings,
          activeBinding:
            state.activeBinding?.chatSessionId === chatSessionId
              ? null
              : state.activeBinding,
        }
      })
    } catch (err) {
      console.error('[sshAgentStore] unbindTerminal failed:', err)
    }
  },

  queryBinding: async (chatSessionId) => {
    try {
      const res = await sshAgentApi.queryBinding(chatSessionId)
      if (res.code === '0000' && res.data?.bound && res.data.terminalSessionId) {
        // 从本地缓存获取完整信息
        const cached = get().bindings.get(chatSessionId)
        if (cached) {
          return cached
        }
      }
      return null
    } catch (err) {
      console.error('[sshAgentStore] queryBinding failed:', err)
      return null
    }
  },

  setActiveBinding: (binding) => set({ activeBinding: binding }),

  setTerminalSelection: (selection) =>
    set({
      terminalSelection: selection,
      showAddToChatHint: selection !== null,
    }),

  clearTerminalSelection: () =>
    set({
      terminalSelection: null,
      showAddToChatHint: false,
    }),

  openConnectionSelector: () => set({ showConnectionSelector: true }),

  closeConnectionSelector: () => set({ showConnectionSelector: false }),

  clearBindingError: () => set({ bindingError: null }),

  getBindingByChatSession: (chatSessionId) => {
    return get().bindings.get(chatSessionId)
  },

  formatServerContext: (binding) => {
    const { serverInfo, connectionName } = binding
    return `当前服务器：${connectionName} (${serverInfo.username}@${serverInfo.host}:${serverInfo.port})`
  },
}))
