import { create } from 'zustand'
import type { SSHConnection, ServerStatus } from '../types'

interface ConnectionStore {
  // 连接列表
  connections: SSHConnection[]
  // 当前选中的连接
  currentConnectionId: string | null
  // 服务端状态
  serverStatus: ServerStatus

  // 添加连接
  addConnection: (conn: SSHConnection) => void
  // 删除连接
  removeConnection: (id: string) => void
  // 选中连接
  selectConnection: (id: string | null) => void
  // 更新服务端状态
  setServerStatus: (status: Partial<ServerStatus>) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  currentConnectionId: null,
  serverStatus: {
    connected: false,
    url: 'http://localhost:8090',
  },

  addConnection: (conn) =>
    set((state) => ({
      connections: [...state.connections, conn],
    })),

  removeConnection: (id) =>
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
      currentConnectionId:
        state.currentConnectionId === id ? null : state.currentConnectionId,
    })),

  selectConnection: (id) =>
    set({ currentConnectionId: id }),

  setServerStatus: (status) =>
    set((state) => ({
      serverStatus: { ...state.serverStatus, ...status },
    })),
}))
