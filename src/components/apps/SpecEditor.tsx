import { useEffect, useState } from 'react'
import { type FdeAppDetail, type FdeAppSkillBind, type FdeAppSource } from '@/lib/app-spec'
import { RuntimeApiError, runtimeApi, type SkillBagItem } from '@/lib/runtime-api'
import type { JsonValue } from '@/lib/contracts'
import { currentAiTarget } from '@/lib/ai-target'
import { SkillBagPicker } from '@/components/biz/SkillBagPicker'

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
  const [sourceType, setSourceType] = useState<FdeAppSource['type']>(app.spec.source?.type || 'local')
  const [systemId, setSystemId] = useState(app.spec.source?.type === 'system' ? app.spec.source.systemId : '')
  const [pickedSkills, setPickedSkills] = useState<FdeAppSkillBind[]>(app.spec.skills || [])
  const [skillBag, setSkillBag] = useState<SkillBagItem[]>([])
  const [systems, setSystems] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    setText(JSON.stringify(app.spec, null, 2))
    setSourceType(app.spec.source?.type || 'local')
    setSystemId(app.spec.source?.type === 'system' ? app.spec.source.systemId : '')
    setPickedSkills(app.spec.skills || [])
  }, [app.id, app.currentRevision])

  useEffect(() => {
    void (async () => {
      const target = await currentAiTarget().catch(() => ({ ok: false as const, error: '' }))
      const [listed, skills] = await Promise.all([
        runtimeApi.getBizSystems().catch(() => ({ systems: [] as Array<Record<string, unknown>> })),
        runtimeApi.listAiSkills(target.ok ? target.sessionId : undefined).catch(() => ({ items: [] as SkillBagItem[] })),
      ])
      setSystems(listed.systems)
      setSkillBag(skills.items.filter((row) => row.path && row.path.startsWith('/')))
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setErrors([])
    setNote('')
    try {
      const spec = JSON.parse(text) as Record<string, unknown>
      let source: FdeAppSource = { type: 'local' }
      if (sourceType === 'lookup') source = { type: 'lookup' }
      if (sourceType === 'system') {
        if (!systemId) {
          setNote('system 需要 systemId')
          setSaving(false)
          return
        }
        source = { type: 'system', systemId }
      }
      spec.source = source
      spec.skills = pickedSkills
      const result: PutSpecResponse = await runtimeApi.putDeclarativeAppSpec(app.id, { spec: spec as JsonValue, changeNote: '保存为新修订' })
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
      setNote('已保存新修订。若加了字段，请再激活以建列。')
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
      <div className="flex gap-2">
        {(['local', 'lookup', 'system'] as const).map((type) => (
          <button key={type} type="button" className={sourceType === type ? 'btn-brand h-7 text-xs' : 'btn h-7 text-xs'} onClick={() => setSourceType(type)}>
            {type}
          </button>
        ))}
      </div>
      {sourceType === 'system' && (
        <label className="text-xs text-ink-muted block">
          业务系统
          <select className="input mt-1" value={systemId} onChange={(event) => setSystemId(event.target.value)}>
            <option value="">选择已登记系统</option>
            {systems.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>
            ))}
          </select>
        </label>
      )}
      {skillBag.length > 0 && (
        <SkillBagPicker skills={skillBag} value={pickedSkills} onChange={setPickedSkills} label="本应用 Skills" />
      )}
      <textarea className="input w-full font-mono text-xs" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      {errors.length > 0 && (
        <ul className="text-xs text-accent-red space-y-0.5">
          {errors.map((err) => <li key={err.path}>{err.path}: {err.message}</li>)}
        </ul>
      )}
      {note && <div className="text-xs text-ink-muted">{note}</div>}
      <button className="btn-brand" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存为新修订'}</button>
    </div>
  )
}
