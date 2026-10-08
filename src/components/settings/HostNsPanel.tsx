import { Card } from '@/components/ui'
import { SettingsDescribeForm } from '@/components/settings/SettingsDescribeForm'
import { useHostSettings, type HostNsEntry } from '@/components/settings/use-host-settings'
import type { SettingsNsHome } from '@/lib/settings-ns-home'

export function HostNsPanel({
  home,
  title,
  hint,
}: {
  home: SettingsNsHome
  title: string
  hint: string
}) {
  const { entries, catalogs, busy, note, save } = useHostSettings()
  const rows = entries.filter((row) => row.home === home)
  return (
    <Card>
      <div className="text-base font-medium">{title}</div>
      <div className="text-xs text-ink-muted mt-0.5 mb-3">{hint}</div>
      {note && <div className="text-xs text-ink-muted mb-2">{note}</div>}
      {rows.length === 0 ? (
        <div className="text-sm text-ink-muted py-4">这一节没有可改的 Host 项。</div>
      ) : (
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
      )}
    </Card>
  )
}
