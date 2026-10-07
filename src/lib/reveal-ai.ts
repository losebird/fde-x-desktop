import { useApp } from '@/store/app'

export function revealAi(sessionId?: string, accessory?: string) {
  const app = useApp.getState()
  const memory = app.panels.find((panel) => panel.id === 'memory' || panel.view === 'memory')
  if (memory && (memory.state === 'full' || memory.state === 'half')) {
    app.togglePanel('memory', 'tab')
  }
  window.dispatchEvent(new CustomEvent('fde-x-ai-open', {
    detail: { sessionId: String(sessionId || ''), accessory: String(accessory || '') },
  }))
}
