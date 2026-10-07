import { Routes, Route, Navigate } from 'react-router-dom'
import { IMScreen } from '@/components/IMScreen'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ai" replace />} />
      <Route element={<IMScreen />}>
        <Route path="/im" element={null} />
        <Route path="/im/:threadId" element={null} />
        <Route path="/briefing" element={null} />
        <Route path="/plan" element={null} />
        <Route path="/tasks" element={null} />
        <Route path="/schedule" element={null} />
        <Route path="/files" element={null} />
        <Route path="/files/:id" element={null} />
        <Route path="/ai" element={null} />
        <Route path="/ai/:chatId" element={null} />
        <Route path="/agents" element={null} />
        <Route path="/data" element={null} />
        <Route path="/mcp" element={null} />
        <Route path="/skills" element={null} />
        <Route path="/memory" element={null} />
        <Route path="/settings" element={null} />
        <Route path="*" element={null} />
      </Route>
    </Routes>
  )
}
