import { useState } from 'react'
import { type FdeAppDetail } from '@/lib/app-spec'
import { RuntimeApiError, runtimeApi } from '@/lib/runtime-api'
import type { JsonValue } from '@/lib/contracts'

type Props = {
  app: FdeAppDetail
  onSaved: () => void
}

type PutSpecResponse = {
  ok: boolean
  data?: { revision: number }
  errors?: { path: string; message: string }[]
  error?: string
}

export function SpecEditor({ app, onSaved }: Props) {
  const [text, setText] = useState(() => JSON.stringify(app.spec, null, 2))
  const [errors, setErrors] = useState<{ path: string; message: string }[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setErrors([])
    setNote('')
    try {
      const spec = JSON.parse(text) as JsonValue
      const result: PutSpecResponse = await runtimeApi.putDeclarativeAppSpec(app.id, { spec, changeNote: '保存为新修订' })
      if (!result.ok || result.errors?.length) {
        if (result.errors?.length) setErrors(result.errors)
        else setNote('校验未通过')
        return
      }
      if (result.error === 'breaking_change') {
        setNote('破坏性变更：不能删字段或改类型')
        setErrors(result.errors ?? [])
        return
      }
      setNote('已保存新修订')
      onSaved()
    } catch (cause) {
      setNote(cause instanceof RuntimeApiError ? cause.message : cause instanceof SyntaxError ? 'JSON 无效' : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-3 border-t border-line bg-surface-2 space-y-2">
      <div className="text-sm font-medium">编辑 spec · 修订 {app.currentRevision}</div>
      <textarea className="input w-full font-mono text-xs" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      {errors.map((err) => (
        <div key={`${err.path}-${err.message}`} className="text-xs text-accent-red">{err.path}: {err.message}</div>
      ))}
      {note && <div className="text-xs text-ink-muted">{note}</div>}
      <button type="button" className="btn-brand h-8" disabled={saving} onClick={() => void save()}>保存为新修订</button>
    </div>
  )
}
