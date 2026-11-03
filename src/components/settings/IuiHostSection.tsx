import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { SurfaceBanner } from '@/components/surface/Banner'
import { runtimeApi } from '@/lib/runtime-api'
import type { HostNsEntry } from '@/components/settings/use-host-settings'
import {
  catalogItemView,
  createIuiCatalogScope,
  snapshotFromEntry,
  snapshotFromView,
  type IuiSettingsValue,
} from '@/components/settings/iui-form-scope'
import type { SettingsFormPathOp, SettingsFormScope } from '@/components/settings/iui-primitives-shim'
import { IuiSettingsCardController, IuiSettingsSection, settingsPrimitivesAvailable } from '@iui/client/settings/IuiSettingsSection.tsx'
import { iuiSettingsZh } from '@iui/client/settings/index.ts'
import { setActiveIuiFormScope } from '@iui/client/settings/config-bridge.ts'
import { setGenuiAssetBase } from '@iui/client/asset-loader.ts'
import { setLocale } from '@iui/client/i18n/index.ts'
import { refreshRuntimeConfig } from '@iui/client/runtime-config.ts'
import './iui-host-tokens.css'

function iuiSettingsT(key: string): string {
  return iuiSettingsZh?.[key] ?? key
}

function pluginAssetBase(): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/plugins/@losebird/iui/assets/`
}

export function IuiHostSection({
  entry,
  writable,
  onReload,
}: {
  entry: HostNsEntry
  writable: boolean
  onReload: () => void
}) {
  const [note, setNote] = useState('')
  const entryRef = useRef(entry)
  const writableRef = useRef(writable)
  const onReloadRef = useRef(onReload)
  entryRef.current = entry
  writableRef.current = writable
  onReloadRef.current = onReload

  const held = useMemo(() => {
    const replaceRef: { current: ((next: ReturnType<typeof snapshotFromEntry>) => void) | null } = { current: null }
    const mutate = async (ops: readonly SettingsFormPathOp[], expectedRevision?: number) => {
      try {
        const bag = await runtimeApi.catalogAction({
          kind: 'settings',
          action: 'mutate',
          params: {
            ns: entryRef.current.ns,
            expectedRevision,
            ops,
          },
        })
        const view = catalogItemView(bag, entryRef.current.ns)
        const next = snapshotFromView(view, writableRef.current) ?? snapshotFromEntry(entryRef.current, writableRef.current)
        replaceRef.current?.(next)
        setNote('')
        onReloadRef.current()
        return true
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        setNote(message || '改不了这项配置。')
        onReloadRef.current()
        return false
      }
    }
    const created = createIuiCatalogScope(snapshotFromEntry(entryRef.current, writableRef.current), mutate)
    replaceRef.current = created.replace
    return created
  }, [])

  useEffect(() => {
    held.replace(snapshotFromEntry(entry, writable))
  }, [entry, held, writable])

  const [card, setCard] = useState<IuiSettingsCardController | null>(null)
  useEffect(() => {
    if (!settingsPrimitivesAvailable()) {
      setCard(null)
      return
    }
    setLocale('zh')
    setGenuiAssetBase(pluginAssetBase())
    setActiveIuiFormScope(held.scope as SettingsFormScope<unknown>)
    const next = new IuiSettingsCardController(held.scope)
    setCard(next)
    void refreshRuntimeConfig()
    return () => {
      next.dispose()
      setActiveIuiFormScope(null)
      setCard(null)
    }
  }, [held])

  if (!settingsPrimitivesAvailable()) {
    return <SurfaceBanner tone="danger">当前 IUI 源码没有挂上设置页。</SurfaceBanner>
  }
  if (!card) {
    return <div className="h-9 rounded-kit bg-kit-muted" aria-busy="true" aria-label="正在读取" />
  }

  const injected = card.inject()
  return (
    <IuiHostFace
      note={note}
      injected={injected}
    />
  )
}

function IuiHostFace({
  note,
  injected,
}: {
  note: string
  injected: ReturnType<IuiSettingsCardController['inject']>
}) {
  const store = injected.hooks.iuiSettings
  const useIuiSettings = ((select: (snapshot: never) => never) => useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot() as never),
    () => select(store.getSnapshot() as never),
  )) as (select: (s: never) => never) => never

  return (
    <div data-iui-settings-host="1">
      {note ? <div className="mb-3"><SurfaceBanner tone="danger">{note}</SurfaceBanner></div> : null}
      <IuiSettingsSection
        t={iuiSettingsT}
        useIuiSettings={useIuiSettings}
        edit={injected.edit}
        resetField={injected.resetField}
        save={injected.save}
        discard={injected.discard}
      />
    </div>
  )
}

export type { IuiSettingsValue }
