import { Link } from 'react-router-dom'
import type { McpConnectorCard } from '@/lib/runtime-api'

export function BusinessList({ rows }: { rows: McpConnectorCard[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-kit-lg border border-kit-line bg-kit-card px-3 py-3">
          <div className="text-kit font-medium text-kit-ink">{row.name}</div>
          <div className="mt-0.5 text-kit-meta text-kit-secondary">{row.provider}</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-kit-meta">
            <span className={`rounded-kit px-2 py-0.5 ${row.online ? 'bg-kit-brand-soft text-kit-brand-ink' : 'bg-kit-warn-soft text-kit-warn'}`}>
              {row.online ? '在线' : '未就绪'}
            </span>
            {row.catalogVersion ? <span className="rounded-kit bg-kit-muted px-2 py-0.5 text-kit-ink">目录 {row.catalogVersion}</span> : null}
            <span className="rounded-kit bg-kit-muted px-2 py-0.5 text-kit-ink">{row.lookupRegistered ? '已登记' : '未登记'}</span>
          </div>
          <div className="mt-3 border-t border-kit-line pt-2">
            <Link to="/settings" className="text-kit-sm text-kit-brand hover:underline">去设置登记</Link>
          </div>
        </div>
      ))}
    </div>
  )
}
