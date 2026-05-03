import './index.css'
import { MainView } from './views/MainView'
import { useEffect } from 'react'
import { useConnectionStore } from './stores/connectionStore'

function App() {
  const startHeartbeat = useConnectionStore((s) => s.startHeartbeat)
  const stopHeartbeat = useConnectionStore((s) => s.stopHeartbeat)

  useEffect(() => {
    // 应用启动时开启心跳检测
    startHeartbeat()
    return () => stopHeartbeat()
  }, [startHeartbeat, stopHeartbeat])

  return <MainView />
}

export default App
