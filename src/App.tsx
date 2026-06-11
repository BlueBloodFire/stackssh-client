import './index.css'
import { MainView } from './views/MainView'
import { LoginView } from './views/LoginView'
import { useEffect } from 'react'
import { useConnectionStore } from './stores/connectionStore'
import { useAuthStore } from './stores/authStore'
import { ConnectionStatus } from './types'

function App() {
  const { isAuthenticated } = useAuthStore()
  const { startHeartbeat, stopHeartbeat, connections, disconnect } = useConnectionStore()

  useEffect(() => {
    if (!isAuthenticated) return
    // 应用启动时：重置所有连接状态为断开（防止后端状态不同步）
    useConnectionStore.setState((state) => ({
      connections: state.connections.map((c) => ({ ...c, status: ConnectionStatus.DISCONNECTED })),
    }))
    startHeartbeat()
    return () => stopHeartbeat()
  }, [isAuthenticated, startHeartbeat, stopHeartbeat])

  useEffect(() => {
    if (!isAuthenticated) return
    const handleBeforeUnload = () => {
      connections
        .filter((c) => c.status === ConnectionStatus.CONNECTED)
        .forEach((c) => disconnect(c.id))
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isAuthenticated, connections, disconnect])

  if (!isAuthenticated) {
    return <LoginView />
  }

  return <MainView />
}

export default App
