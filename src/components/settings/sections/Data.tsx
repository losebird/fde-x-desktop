import { useCallback, useEffect, useState } from 'react'
import { useWhenCoreConnects } from '@/components/settings/core-connection'
import { Database, RefreshCw, Trash2 } from 'lucide-react'
import { Tag } from '@/components/ui'
import { SurfaceButton } from '@/components/surface/Button'
import { SurfaceBanner } from '@/components/surface/Banner'
import { surfaceNote } from '@/components/settings/surface-note'
import { runtimeApi } from '@/lib/runtime-api'
import { useApp } from '@/store/app'

function SqliteBackupCard() {
  const [items, setItems] = useState<Array<{ file: string; name: string }>>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    void runtimeApi.listRuntimeBackups().then((data) => {
      setItems(data.items)
    }).catch((cause) => setNote(surfaceNote(cause, '读不到备份。')))
  }, [])

  useEffect(() => { load() }, [load])
  useWhenCoreConnects(load, true)

  return (
    <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
      <h3 className="text-kit-title font-medium text-kit-ink">工作台库备份</h3>
      <p className="mt-1 text-kit-sm text-kit-secondary">快照在本机 data/backups。还原后核心会重载。</p>
      {note ? <div className="mt-2"><SurfaceBanner tone="quiet">{note}</SurfaceBanner></div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <SurfaceButton
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void runtimeApi.takeRuntimeBackup().then((row) => {
              setNote(`已备份 ${row.name}`)
              load()
            }).catch((cause) => setNote(surfaceNote(cause, '备份失败')))
              .finally(() => setBusy(false))
          }}
        >
          备份
        </SurfaceButton>
        <SurfaceButton
          disabled={busy || !items[0]}
          onClick={() => {
            const latest = items[0]
            if (!latest) return
            setBusy(true)
            void runtimeApi.restoreRuntimeBackup(latest.file).then(() => {
              setNote('已还原最近一份，正在重载核心。')
            }).catch((cause) => setNote(surfaceNote(cause, '还原失败')))
              .finally(() => setBusy(false))
          }}
        >
          还原最近一份
        </SurfaceButton>
      </div>
      {items[0] ? <div className="mt-2 text-kit-sm text-kit-secondary">{items[0].name}</div> : null}
    </section>
  )
}

export function DataSection() {
  const resetDemo = useApp((s) => s.resetDemo)

  return (
    <div className="space-y-4">
      <SqliteBackupCard />
      <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
        <h3 className="mb-3 text-kit-title font-medium text-kit-ink">存储状态</h3>
        <div className="space-y-3 text-kit">
          <div className="flex items-start gap-3 rounded-kit border border-kit-brand/25 bg-kit-brand-soft px-3 py-3">
            <Database size={15} className="mt-0.5 shrink-0 text-kit-brand" />
            <div>
              <div className="font-medium text-kit-ink">事务数据在本机 SQLite</div>
              <p className="mt-1 text-kit-sm leading-5 text-kit-secondary">任务、计划、工作流、会话正文、业务操作与审计由运行时写入本机数据库。浏览器里只保留界面习惯，不能当成业务数据的来源。</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-kit bg-kit-muted px-3 py-3">
            <div>
              <div className="font-medium text-kit-ink">浏览器壳层状态</div>
              <p className="mt-1 text-kit-sm leading-5 text-kit-secondary">布局、工作区选择和输入草稿存在这台浏览器里。任务、会话正文和审计以本机数据库为准。</p>
            </div>
            <Tag kind="blue">本机浏览器</Tag>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-kit bg-kit-muted px-3 py-3">
            <div>
              <div className="font-medium text-kit-ink">语义记忆存储</div>
              <p className="mt-1 text-kit-sm text-kit-secondary">知识图谱和检索索引仍由语义服务管理，不迁入事务库。</p>
            </div>
            <Tag kind="blue">独立权威</Tag>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SurfaceButton disabled><RefreshCw size={14} /> 导出还没接到运行时</SurfaceButton>
          <SurfaceButton
            variant="danger"
            onClick={() => {
              if (confirm('只重置浏览器中的 demo 缓存，不会删除 SQLite 或语义存储。确认?')) resetDemo()
            }}
          >
            <Trash2 size={14} /> 重置前端 demo
          </SurfaceButton>
        </div>
      </section>
    </div>
  )
}
