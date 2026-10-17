import { useCallback, useEffect, useState } from 'react'
import { Activity, Bot, Brain, MessageCircleMore, RefreshCw, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { Tag } from '@/components/ui'
import { SurfaceBanner } from '@/components/surface/Banner'
import { SurfaceButton } from '@/components/surface/Button'
import { useCoreBoot, useWhenCoreConnects } from '@/components/settings/core-connection'
import { surfaceNote } from '@/components/settings/surface-note'
import { runtimeApi, type RuntimeHealth } from '@/lib/runtime-api'

export function RuntimeSection() {
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealth | null>(null)
  const [runtimeError, setRuntimeError] = useState('')
  const [runtimeLoading, setRuntimeLoading] = useState(false)

  const diagnoseRuntime = useCallback(async () => {
    setRuntimeLoading(true)
    setRuntimeError('')
    try {
      setRuntimeHealth(await runtimeApi.health())
    } catch (cause) {
      setRuntimeHealth(null)
      setRuntimeError(surfaceNote(cause, '读不到运行环境。'))
    } finally {
      setRuntimeLoading(false)
    }
  }, [])

  useEffect(() => { void diagnoseRuntime() }, [diagnoseRuntime])
  useWhenCoreConnects(() => { void diagnoseRuntime() }, true)
  const boot = useCoreBoot(true)

  return (
    <div className="space-y-4">
      <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-kit-title font-medium text-kit-ink">运行环境诊断</h3>
            <p className="mt-1 text-kit-sm text-kit-secondary">检查事务存储和三类能力入口。发现源码不算已经接通。</p>
          </div>
          <SurfaceButton disabled={runtimeLoading} onClick={() => void diagnoseRuntime()}>
            <RefreshCw size={14} className={runtimeLoading ? 'animate-spin' : ''} /> 重新检查
          </SurfaceButton>
        </div>
        {runtimeError ? (
          <SurfaceBanner tone="danger">{runtimeError}</SurfaceBanner>
        ) : runtimeHealth ? (
          <div className="space-y-2">
            <RuntimeRow
              icon={ShieldCheck}
              name="事务存储"
              state={runtimeHealth.persistence.state}
              detail={`SQLite · ${runtimeHealth.persistence.database.tableCount} 张表 · ${runtimeHealth.persistence.migrations.length} 个迁移`}
            />
            {runtimeHealth.adapters.map((adapter) => (
              <RuntimeRow
                key={adapter.capability}
                icon={adapter.capability === 'ai-runtime' ? Bot : adapter.capability === 'im-business-adapter' ? MessageCircleMore : Brain}
                name={adapter.capability === 'ai-runtime' ? 'AI、文件、工具与自动化' : adapter.capability === 'im-business-adapter' ? 'IM 与业务系统操作' : '语义记忆'}
                state={adapter.state}
                detail={adapter.capability === 'ai-runtime' && boot.text && boot.kind !== 'failed'
                  ? boot.text
                  : `${adapter.version ? `${adapter.version} · ` : ''}${adapter.detail ?? ''}`}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2" aria-busy="true" aria-label="正在读取">
            <div className="h-12 rounded-kit bg-kit-muted" />
            <div className="h-12 rounded-kit bg-kit-muted" />
          </div>
        )}
      </section>
      <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
        <h3 className="mb-3 text-kit-title font-medium text-kit-ink">权威边界</h3>
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
          <AuthorityCard title="工作台事务" authority="SQLite" detail="AI 运行记录、IM、计划、工作流、文件元数据、配置、业务操作与审计。" />
          <AuthorityCard title="语义知识" authority="语义服务" detail="知识图谱、记忆卡、本体、决策知识与语义索引，不迁入 SQLite。" />
          <AuthorityCard title="业务现账" authority="源系统" detail="订单、客户等记录的当前状态，以业务系统查询结果和回执为准。" />
        </div>
      </section>
    </div>
  )
}

function RuntimeRow({ icon: Icon, name, state, detail }: { icon: typeof Activity; name: string; state: string; detail: string }) {
  const healthy = state === 'healthy'
  const unavailable = state === 'unavailable'
  return (
    <div className="flex items-start gap-3 rounded-kit border border-kit-line px-3 py-3">
      <div className={clsx(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-kit border',
        healthy ? 'border-kit-brand/25 bg-kit-brand-soft text-kit-brand' : unavailable ? 'border-transparent bg-kit-danger-soft text-kit-danger' : 'bg-kit-warn-soft text-kit-warn',
      )}>
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-kit font-medium text-kit-ink">{name}</div>
        <div className="mt-0.5 text-kit-sm leading-5 text-kit-secondary">{detail}</div>
      </div>
      <Tag kind={healthy ? 'green' : unavailable ? 'red' : 'amber'}>{healthy ? '正常' : unavailable ? '不可用' : '待接通'}</Tag>
    </div>
  )
}

function AuthorityCard({ title, authority, detail }: { title: string; authority: string; detail: string }) {
  return (
    <div className="rounded-kit bg-kit-muted p-3">
      <div className="text-kit-meta text-kit-secondary">{title}</div>
      <div className="mt-1 text-kit font-medium text-kit-ink">{authority}</div>
      <div className="mt-2 text-kit-sm leading-5 text-kit-secondary">{detail}</div>
    </div>
  )
}
