import { Routes, Route, Navigate } from 'react-router-dom'
import { IMScreen } from '@/components/IMScreen'

export default function App() {
  return (
    <Routes>
      {/* AI-first:根路径默认进入 AI */}
      <Route path="/" element={<Navigate to="/ai" replace />} />
      {/* 统一走 IM 母版;所有页面都渲染 IMScreen,由它根据 pathname 自动展开右侧面板。*/}
      <Route path="/im" element={<IMScreen />} />
      <Route path="/im/:threadId" element={<IMScreen />} />
      <Route path="/briefing" element={<IMScreen />} />
      <Route path="/plan" element={<IMScreen />} />
      <Route path="/tasks" element={<IMScreen />} />
      <Route path="/schedule" element={<IMScreen />} />
      <Route path="/files" element={<IMScreen />} />
      <Route path="/files/:id" element={<IMScreen />} />
      <Route path="/ai" element={<IMScreen />} />
      <Route path="/ai/:chatId" element={<IMScreen />} />
      <Route path="/agents" element={<IMScreen />} />
      <Route path="/data" element={<IMScreen />} />
      <Route path="/mcp" element={<IMScreen />} />
      <Route path="/skills" element={<IMScreen />} />
      <Route path="/memory" element={<IMScreen />} />
      <Route path="/settings" element={<IMScreen />} />
      <Route path="*" element={<IMScreen />} />
    </Routes>
  )
}
