import { useState } from 'react'
import type { FdeAppSpec, FdePlatformUse } from '@/lib/app-spec'
import { declaredPlatformUses, platformUseLabel, runDeclaredPlatformUse } from '@/lib/app-platform'

type Props = {
  spec: FdeAppSpec
}

export function AppCapabilityBar({ spec }: Props) {
  const uses = declaredPlatformUses(spec)
  const [note, setNote] = useState('')
  if (!uses.length) return null

  const run = async (use: FdePlatformUse) => {
    setNote('')
    try {
      setNote(await runDeclaredPlatformUse(use, spec))
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : '未能打开平台能力')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-app-uses={uses.join(',')}>
      {uses.map((use) => (
        <button
          key={use}
          type="button"
          className="btn h-7"
          data-app-use={use}
          onClick={() => { void run(use) }}
        >
          {platformUseLabel(use)}
        </button>
      ))}
      {note && <span className="text-xs text-ink-muted" data-app-capability-note="true">{note}</span>}
    </div>
  )
}
