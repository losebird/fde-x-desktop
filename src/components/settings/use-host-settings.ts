import { useCallback, useEffect, useState } from 'react'
import { runtimeApi, type AiModelCatalog } from '@/lib/runtime-api'
import { hostText } from '@/lib/host-text'
import {
  flattenModelRoutes,
  hostPackageHeading,
  pluginRecordForNs,
  settingsNsHome,
  type SettingsNsHome,
} from '@/lib/settings-ns-home'
import { dirtyTopLevelOps, rootObjectUid, type SettingsCatalog } from '@/lib/settings-schema'
import { SURFACE_CORE_DOWN, classifySurfaceFailure, type SurfacePhase } from '@/components/surface/phase'

export type HostNsEntry = {
  ns: string
  home: SettingsNsHome
  title: string
  hint: string
  revision: number
  schema: Record<string, unknown>
  value: unknown
  secrets: unknown
}

function conflictCause(cause: unknown) {
  if (!cause || typeof cause !== 'object') return false
  const row = cause as { status?: unknown; code?: unknown }
  return row.status === 409 || row.code === 'id_conflict'
}

export function useHostSettings() {
  const [entries, setEntries] = useState<HostNsEntry[]>([])
  const [catalogs, setCatalogs] = useState<SettingsCatalog[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<SurfacePhase>('loading')
  const [message, setMessage] = useState('')

  const load = useCallback(() => {
    setPhase((current) => (current === 'ready' ? 'ready' : 'loading'))
    void (async () => {
      try {
        const [settingsBag, pluginBag, models, aiCatalog] = await Promise.all([
          runtimeApi.catalogBag('settings'),
          runtimeApi.catalogBag('plugin'),
          runtimeApi.getModelsSettings().catch(() => null),
          runtimeApi.aiModels().catch(() => null as AiModelCatalog | null),
        ])
        const status = await runtimeApi.aiStatus().catch(() => null)
        const plugins = Array.isArray(pluginBag.items) ? pluginBag.items.map((row) => ({
          id: row.id,
          title: row.title,
          fields: row.fields && typeof row.fields === 'object' ? row.fields as Record<string, unknown> : {},
        })) : []
        const owned = new Set(
          (models?.rows || []).map((row) => String(row.settingsNs || '')).filter(Boolean),
        )
        setCatalogs(flattenModelRoutes(models, aiCatalog))
        const rows = Array.isArray(settingsBag.items) ? settingsBag.items : []
        const nextEntries = rows.map((row) => {
          const fields = row.fields && typeof row.fields === 'object' ? row.fields as Record<string, unknown> : {}
          const schema = fields.schema && typeof fields.schema === 'object' ? fields.schema as Record<string, unknown> : null
          if (!schema || !rootObjectUid(schema)) return null
          const ns = row.id
          const rec = pluginRecordForNs(plugins, ns)
          const rawTitle = hostText(rec.meta.title) || hostText(rec.title) || row.title || ns
          const heading = hostPackageHeading(rawTitle)
          const description = hostText(rec.meta.description)
          const hint = description && !/plugin:|@/i.test(description) ? description : ''
          return {
            ns,
            home: settingsNsHome(ns, owned),
            title: heading,
            hint,
            revision: Number(fields.revision || 0),
            schema,
            value: fields.value,
            secrets: fields.secrets,
          }
        }).filter((row): row is HostNsEntry => Boolean(row))
        setEntries(nextEntries)
        const bagError = settingsBag.error ? String(settingsBag.error) : ''
        const connected = Boolean(status?.connected)
        if (!nextEntries.length && !connected) {
          setPhase('coreDown')
          setMessage(SURFACE_CORE_DOWN)
          setNote('')
          return
        }
        if (!nextEntries.length && bagError) {
          const failure = classifySurfaceFailure(bagError, '读不了这项配置。')
          setPhase(failure.phase)
          setMessage(failure.message)
          setNote('')
          return
        }
        setPhase('ready')
        setMessage('')
        setNote(bagError ? classifySurfaceFailure(bagError, '有一项没读全。').message : '')
      } catch (cause) {
        const failure = classifySurfaceFailure(cause, '读不了这项配置。')
        setPhase(failure.phase)
        setMessage(failure.message)
        setNote('')
      }
    })()
  }, [])

  useEffect(() => { load() }, [load])

  const connect = () => {
    setPhase('loading')
    setMessage('')
    void runtimeApi.connectAi().then(() => load()).catch((cause) => {
      const failure = classifySurfaceFailure(cause, '连接没有完成。')
      setPhase(failure.phase)
      setMessage(failure.message)
    })
  }

  const save = (entry: HostNsEntry, next: Record<string, unknown>) => {
    const ops = dirtyTopLevelOps(entry.value, next)
    if (!ops.length) return
    setBusy(true)
    setNote('')
    void runtimeApi.catalogAction({
      kind: 'settings',
      action: 'mutate',
      params: {
        ns: entry.ns,
        expectedRevision: entry.revision,
        ops,
      },
    }).then(() => load()).catch((cause) => {
      const failure = classifySurfaceFailure(cause, '改不了这项配置。')
      setNote(failure.message)
      if (conflictCause(cause)) load()
    }).finally(() => setBusy(false))
  }

  return { entries, catalogs, busy, note, phase, message, load, save, connect }
}
