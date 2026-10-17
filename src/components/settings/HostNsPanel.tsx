import { Inbox } from 'lucide-react'
import { SurfaceBanner } from '@/components/surface/Banner'
import { SurfaceButton } from '@/components/surface/Button'
import { SurfaceEmpty, SurfaceGuide } from '@/components/surface/EmptyState'
import { SURFACE_CORE_DOWN, SURFACE_UNREACHABLE } from '@/components/surface/phase'
import { SettingsDescribeForm } from '@/components/settings/SettingsDescribeForm'
import { useCoreBoot } from '@/components/settings/core-connection'
import { useHostSettings, type HostNsEntry } from '@/components/settings/use-host-settings'
import type { SettingsNsHome } from '@/lib/settings-ns-home'

function openRuntime() {
  window.dispatchEvent(new CustomEvent('fde-x-settings-open', { detail: { section: 'runtime' } }))
}

export function HostNsPanel({
  home,
  title,
  hint,
}: {
  home: SettingsNsHome
  title: string
  hint: string
}) {
  const { entries, catalogs, busy, note, phase, message, load, save, connect } = useHostSettings()
  const boot = useCoreBoot(phase === 'coreDown')
  const rows = entries.filter((row) => row.home === home)
  const blocked = rows.length === 0 && (phase === 'loading' || phase === 'unreachable' || phase === 'coreDown' || phase === 'error')

  return (
    <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
      <h3 className="text-kit-title font-medium text-kit-ink">{title}</h3>
      <p className="mb-3 mt-1 text-kit-sm leading-5 text-kit-secondary">{hint}</p>
      {note ? <div className="mb-3"><SurfaceBanner tone="danger">{note}</SurfaceBanner></div> : null}
      {phase === 'loading' && rows.length === 0 ? (
        <div className="space-y-2" aria-busy="true" aria-label="正在读取">
          <div className="h-9 rounded-kit bg-kit-muted" />
          <div className="h-9 w-2/3 rounded-kit bg-kit-muted" />
        </div>
      ) : null}
      {phase === 'unreachable' && rows.length === 0 ? (
        <SurfaceGuide
          title="连不上本机核心"
          body={message || SURFACE_UNREACHABLE}
          action={<SurfaceButton onClick={() => load()}>再试一次</SurfaceButton>}
        />
      ) : null}
      {phase === 'coreDown' && rows.length === 0 && boot.kind === 'starting' ? (
        <SurfaceGuide title="正在首次启动" body={boot.text} />
      ) : null}
      {phase === 'coreDown' && rows.length === 0 && boot.kind === 'failed' ? (
        <SurfaceGuide
          title="核心没有接通"
          body={boot.text}
          action={(
            <div className="flex flex-wrap gap-2">
              <SurfaceButton variant="primary" onClick={() => connect()}>连接核心</SurfaceButton>
              <SurfaceButton onClick={openRuntime}>去运行环境查看</SurfaceButton>
            </div>
          )}
        />
      ) : null}
      {phase === 'coreDown' && rows.length === 0 && boot.kind !== 'starting' && boot.kind !== 'failed' ? (
        <SurfaceGuide
          title="核心还没接通"
          body={`${hint} ${message || SURFACE_CORE_DOWN}`}
          action={(
            <div className="flex flex-wrap gap-2">
              <SurfaceButton variant="primary" onClick={() => connect()}>连接核心</SurfaceButton>
              <SurfaceButton onClick={openRuntime}>去运行环境查看</SurfaceButton>
            </div>
          )}
        />
      ) : null}
      {phase === 'error' && rows.length === 0 ? (
        <SurfaceGuide
          title="这一节没有读出来"
          body={message || '读不了这项配置。'}
          action={<SurfaceButton onClick={() => load()}>重试</SurfaceButton>}
        />
      ) : null}
      {!blocked && rows.length === 0 ? (
        <SurfaceEmpty icon={Inbox} title="这一节没有可改的项" body="核心里这一类现在是空的。" />
      ) : null}
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((entry: HostNsEntry) => (
            <SettingsDescribeForm
              key={entry.ns}
              ns={entry.ns}
              title={entry.title}
              hint={entry.hint}
              schema={entry.schema}
              value={entry.value}
              secrets={entry.secrets}
              catalogs={catalogs}
              revision={entry.revision}
              disabled={busy}
              onSave={(next) => save(entry, next)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
