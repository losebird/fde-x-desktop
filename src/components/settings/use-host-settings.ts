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

export function useHostSettings() {
  const [entries, setEntries] = useState<HostNsEntry[]>([])
  const [catalogs, setCatalogs] = useState<SettingsCatalog[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    void Promise.all([
      runtimeApi.catalogBag('settings'),
      runtimeApi.catalogBag('plugin'),
      runtimeApi.getModelsSettings().catch(() => null),
      runtimeApi.aiModels().catch(() => null as AiModelCatalog | null),
    ]).then(([settingsBag, pluginBag, models, aiCatalog]) => {
      if (settingsBag.error) setNote(String(settingsBag.error))
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
      setEntries(rows.map((row) => {
        const fields = row.fields && typeof row.fields === 'object' ? row.fields as Record<string, unknown> : {}
        const schema = fields.schema && typeof fields.schema === 'object' ? fields.schema as Record<string, unknown> : null
        if (!schema || !rootObjectUid(schema)) return null
        const ns = row.id
        const rec = pluginRecordForNs(plugins, ns)
        const rawTitle = hostText(rec.meta.title) || hostText(rec.title) || row.title || ns
        const heading = hostPackageHeading(rawTitle)
        const hint = [hostText(rec.meta.description), heading !== rawTitle ? String(rawTitle) : ''].filter(Boolean).join(' · ')
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
      }).filter((row): row is HostNsEntry => Boolean(row)))
    }).catch((cause) => {
      setEntries([])
      setCatalogs([])
      setNote(cause instanceof Error ? cause.message : '读不了 Host 配置')
    })
  }, [])

  useEffect(() => { load() }, [load])

  const save = (entry: HostNsEntry, next: Record<string, unknown>) => {
    const ops = dirtyTopLevelOps(entry.value, next)
    if (!ops.length) return
    setBusy(true)
    void runtimeApi.catalogAction({
      kind: 'settings',
      action: 'mutate',
      params: {
        ns: entry.ns,
        expectedRevision: entry.revision,
        ops,
      },
    }).then(() => load()).catch((cause) => setNote(cause instanceof Error ? cause.message : '改不了这项配置')).finally(() => setBusy(false))
  }

  return { entries, catalogs, busy, note, load, save }
}
