import './index.css'
import { MainViewV2 } from './views/MainViewV2'
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

  // 使用 MainViewV2 启用 SSH 智能体交互功能
  return <MainViewV2 />
}

export default App
