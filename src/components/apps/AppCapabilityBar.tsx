import { useState, type ReactNode } from 'react'
import type { FdeAppSpec, FdePlatformUse } from '@/lib/app-spec'
import { recordActionUses } from '@/lib/app-spec'
import {
  isMemoryDraftCard,
  platformUseLabel,
  runDeclaredPlatformUse,
} from '@/lib/app-platform'
import type { MemoryDraftCard } from '@/lib/runtime-api'
import { runtimeApi } from '@/lib/runtime-api'

/** Same chip as card 「打开」— record actions, not a platform toolbar. */
export const recordActionChipClass =
  'inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-line bg-surface-2 text-ink text-[12px] font-medium hover:bg-surface transition-colors'

type Props = {
  spec: FdeAppSpec
  appId: string
  uses?: FdePlatformUse[]
  primary?: ReactNode
  title?: string
  rowId?: string
}

export function AppCapabilityBar({ spec, appId, uses: usesProp, primary, title, rowId }: Props) {
  const uses = (usesProp ?? recordActionUses(spec)).filter((use) => use !== 'float')
  const [note, setNote] = useState('')
  const [draftCard, setDraftCard] = useState<MemoryDraftCard | null>(null)
  const [nodding, setNodding] = useState(false)
  if (!uses.length && !primary) return null

  const run = async (use: FdePlatformUse) => {
    setNote('')
    if (use !== 'memory') setDraftCard(null)
    try {
      const result = await runDeclaredPlatformUse(use, spec, appId, { title, rowId })
      if (isMemoryDraftCard(result)) {
        setDraftCard(result)
        setNote('已起草记忆卡片，点头才入档')
        return
      }
      setDraftCard(null)
      setNote(result)
    } catch (cause) {
      setDraftCard(null)
      setNote(cause instanceof Error ? cause.message : '未能打开平台能力')
    }
  }

  const nodDraft = async () => {
    if (!draftCard || nodding) return
    setNodding(true)
    setNote('')
    try {
      await runtimeApi.nodMemoryCard(draftCard.id)
      setDraftCard(null)
      setNote('已点头入档')
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : '点头入档失败')
    } finally {
      setNodding(false)
    }
  }

  return (
    <div className={primary ? 'flex w-full flex-col gap-2' : 'contents'}>
      <div
        className={primary ? 'flex flex-wrap items-center gap-2' : 'contents'}
        data-app-record-actions="true"
        data-app-column-uses={uses.join(',')}
      >
        {primary}
        {uses.map((use) => (
          <button
            key={use}
            type="button"
            className={recordActionChipClass}
            data-app-use={use}
            onClick={() => { void run(use) }}
          >
            {platformUseLabel(use)}
          </button>
        ))}
        {note && <span className="text-xs text-ink-muted" data-app-capability-note="true">{note}</span>}
      </div>
      {draftCard && (
        <div
          className="rounded-md border border-line bg-surface p-3 text-sm"
          data-memory-draft-card="true"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-ink-muted" data-memory-card-status="起草">起草</span>
            <span className="text-xs text-ink-muted">{draftCard.label}</span>
          </div>
          <pre className="whitespace-pre-wrap text-xs text-ink" data-memory-draft-body="true">{draftCard.body}</pre>
          <button
            type="button"
            className="btn mt-3 h-7"
            data-memory-nod="true"
            disabled={nodding}
            onClick={() => { void nodDraft() }}
          >
            点头入档
          </button>
        </div>
      )}
    </div>
  )
}
