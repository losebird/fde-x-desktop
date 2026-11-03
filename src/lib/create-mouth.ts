import { useEffect } from 'react'
import { openRef } from '@/lib/open-ref'
import { useApp } from '@/store/app'

export type CreateMouth = 'session' | 'task' | 'event' | 'workflow' | 'app'

export function beginCreate(kind: CreateMouth) {
  const app = useApp.getState()
  app.openCreateMouth(kind)
  if (kind === 'session') {
    openRef({ panel: 'ai' })
    return
  }
  if (kind === 'task') {
    openRef({ panel: 'plan', tab: 'todo' })
    return
  }
  if (kind === 'event') {
    openRef({ panel: 'plan', tab: 'schedule' })
    return
  }
  if (kind === 'workflow') {
    openRef({ panel: 'plan', tab: 'workflow' })
    return
  }
  app.setDataBrowse({ view: 'overview' })
  openRef({ panel: 'data' })
}

export function useCreateMouth(kind: CreateMouth, open: () => void) {
  const mouth = useApp((state) => state.createMouth)
  useEffect(() => {
    if (!mouth || mouth.kind !== kind) return
    open()
    const latest = useApp.getState().createMouth
    if (latest && latest.seq === mouth.seq) useApp.getState().clearCreateMouth()
  }, [kind, mouth, open])
}
