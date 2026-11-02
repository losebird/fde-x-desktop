import { useCallback, useEffect, useState } from 'react'
import { SurfaceBanner, SurfaceButton, SurfaceField, SurfaceInput } from '@/components/surface'
import { useWhenCoreConnects } from '@/components/settings/core-connection'
import { surfaceNote } from '@/components/settings/surface-note'
import { runtimeApi } from '@/lib/runtime-api'

export function ImRelayCard() {
  const [url, setUrl] = useState('')
  const [credsPath, setCredsPath] = useState('')
  const [credsSet, setCredsSet] = useState(false)
  const [envLocked, setEnvLocked] = useState(false)
  const [connected, setConnected] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const apply = (row: { configured: boolean; connected: boolean; url: string; credsSet: boolean; env: boolean; error: string }) => {
    setConfigured(row.configured)
    setConnected(row.connected)
    setUrl(row.url)
    setCredsSet(row.credsSet)
    setEnvLocked(row.env)
    setError(row.error)
  }

  const load = useCallback(() => {
    void runtimeApi.imRelay().then((row) => {
      apply(row)
      setLoaded(true)
      setNote('')
    }).catch((cause) => {
      setLoaded(false)
      setNote(surfaceNote(cause, '读不到 IM 中继。'))
    })
  }, [])

  useEffect(() => { load() }, [load])
  useWhenCoreConnects(load, true)

  const save = async () => {
    setBusy(true)
    setNote('')
    try {
      const row = await runtimeApi.saveImRelay({
        url: url.trim(),
        ...(credsPath.trim() ? { credsPath: credsPath.trim() } : {}),
      })
      apply(row)
      setCredsPath('')
      setNote(row.configured ? (row.connected ? '中继已接通。' : '中继已保存，正在连接。') : '中继已关闭。只走局域网配对。')
    } catch (cause) {
      setNote(surfaceNote(cause, '中继没保存。'))
    } finally {
      setBusy(false)
    }
  }

  const status = !loaded
    ? (note || '正在读取')
    : connected
      ? '已接通'
      : configured
        ? (error || '已配置，未连上')
        : '未接通'
  const statusClass = connected
    ? 'bg-kit-brand-soft text-kit-brand-ink'
    : configured
      ? 'bg-kit-warn-soft text-kit-warn'
      : 'bg-kit-muted text-kit-ink'

  return (
    <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
      <h3 className="text-kit-title font-medium text-kit-ink">IM 跨网中继</h3>
      <p className="mt-1 text-kit-sm text-kit-secondary">本机投递底座。同事配对仍在 IM「添加同事」。空地址即关闭中继，只走局域网。</p>
      <div className={`mt-3 inline-flex rounded-kit px-2 py-0.5 text-kit-meta ${statusClass}`}>{status}</div>
      {envLocked ? (
        <div className="mt-3">
          <SurfaceBanner tone="warn">环境变量 DSH_LAN_ASSIST_NATS 已接管地址，这里改不了。</SurfaceBanner>
        </div>
      ) : null}
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (busy || envLocked) return
          void save()
        }}
      >
        <SurfaceField label="中继地址">
          <SurfaceInput
            className="font-mono"
            value={url}
            disabled={busy || envLocked}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="wss://relay.example/nats"
            autoComplete="off"
            spellCheck={false}
          />
        </SurfaceField>
        <SurfaceField label={credsSet ? '设备令牌文件 · 已设置' : '设备令牌文件'}>
          <SurfaceInput
            className="font-mono"
            value={credsPath}
            disabled={busy || envLocked}
            onChange={(event) => setCredsPath(event.target.value)}
            placeholder="/绝对路径/device.creds"
            autoComplete="off"
            spellCheck={false}
          />
        </SurfaceField>
        {note ? <div className="text-kit-sm text-kit-secondary">{note}</div> : null}
        <SurfaceButton type="submit" disabled={busy || envLocked}>保存中继</SurfaceButton>
      </form>
    </section>
  )
}
