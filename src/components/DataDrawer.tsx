// 业务数据抽屉:订单/客户/产品 三表 CRUD + 排序 + 筛选 + 分页
import { useMemo, useState } from 'react'
import { Search, Plus, Trash2, ArrowUp, ArrowDown, Database } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/store/app'
import { DrawerShell } from './DrawerShell'
import { ResizablePanel } from './ResizablePanel'
import type { ID } from '@/lib/types'

interface Props {
  onCollapse?: () => void
}

export function DataDrawer({ onCollapse }: Props) {
  const drawers = useApp((s) => s.drawers)
  const setWidth = useApp((s) => s.setDrawerWidth)
  const close = () => useApp.getState().setDrawerVisible('data', false)
  const width = drawers.data.width

  const tables = useApp((s) => s.businessTables)
  const active = useApp((s) => s.activeBusinessTable)
  const setActive = useApp((s) => s.setActiveBusinessTable)
  const addRow = useApp((s) => s.addRow)
  const removeRow = useApp((s) => s.removeRow)
  const updateRow = useApp((s) => s.updateRow)

  const table = tables.find((t) => t.id === active) ?? tables[0]
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const PAGE = 10

  const filteredRows = useMemo(() => {
    if (!table) return []
    let rows = table.rows
    if (query) {
      const q = query.toLowerCase()
      rows = rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)))
    }
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const va = a[sortKey] as string | number
        const vb = b[sortKey] as string | number
        if (va === vb) return 0
        const cmp = va > vb ? 1 : -1
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  }, [table, query, sortKey, sortDir])

  const pageRows = filteredRows.slice(page * PAGE, (page + 1) * PAGE)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE))

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleAdd = () => {
    if (!table) return
    const empty: Record<string, string | number> = { id: `new_${Date.now()}` }
    table.columns.forEach((c) => { empty[c.key] = c.type === 'number' || c.type === 'amount' ? 0 : '' })
    addRow(table.id, empty)
    setPage(0)
  }

  return (
    <ResizablePanel side="right" width={width} onResize={(w) => setWidth('data', w)}>
      <DrawerShell
        title={
          <div className="flex items-center gap-2">
            <Database size={16} className="text-emerald-600" />
            <span>业务数据</span>
          </div>
        }
        subtitle={table ? `${table.name} · ${table.rows.length} 条` : '订单 / 客户 / 产品'}
        onClose={close}
        onCollapse={onCollapse}
      >
        {/* 表切换 */}
        <div className="px-3 py-2 border-b border-neutral-100 flex items-center gap-1">
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActive(t.id); setPage(0); setSortKey(null) }}
              className={clsx(
                'px-3 py-1 text-xs rounded',
                t.id === active ? 'bg-emerald-100 text-emerald-800' : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {t.name}
            </button>
          ))}
          <div className="ml-auto" />
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0) }}
              placeholder="筛选..."
              className="pl-7 pr-2 py-1 text-xs border border-neutral-200 rounded w-32 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={handleAdd}
            className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1"
          >
            <Plus size={12} /> 新增
          </button>
        </div>

        {/* 表 */}
        {table && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>
                    {table.columns.map((c) => (
                      <th
                        key={c.key}
                        onClick={() => toggleSort(c.key)}
                        className="text-left px-3 py-2 font-medium text-neutral-700 border-b border-neutral-200 cursor-pointer hover:bg-neutral-100"
                      >
                        <span className="inline-flex items-center gap-1">
                          {c.label}
                          {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 border-b border-neutral-200 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr><td colSpan={table.columns.length + 1} className="text-center py-8 text-neutral-400">无数据</td></tr>
                  )}
                  {pageRows.map((r) => (
                    <tr key={r.id as string} className="border-b border-neutral-100 hover:bg-neutral-50">
                      {table.columns.map((c) => (
                        <td key={c.key} className="px-3 py-1.5">
                          {c.type === 'amount' ? (
                            <span className="text-emerald-700">¥{Number(r[c.key]).toLocaleString()}</span>
                          ) : c.type === 'status' ? (
                            <span className={clsx(
                              'px-1.5 py-0.5 rounded text-[10px]',
                              String(r[c.key]) === '已完成' || String(r[c.key]) === '已付款' ? 'bg-emerald-100 text-emerald-700' :
                              String(r[c.key]) === '进行中' ? 'bg-blue-100 text-blue-700' :
                              'bg-neutral-100 text-neutral-600',
                            )}>{String(r[c.key])}</span>
                          ) : (
                            <input
                              value={String(r[c.key] ?? '')}
                              readOnly
                              title="原型记录只读；真实写入请从操作控制发起"
                              className="w-full bg-transparent px-1 py-0.5 rounded cursor-default"
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => { if (confirm('删除该行?')) removeRow(table.id, r.id as ID) }}
                          className="p-1 text-neutral-400 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-neutral-100 text-xs flex items-center gap-2 text-neutral-500">
              <span>共 {filteredRows.length} 条</span>
              <div className="ml-auto flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="px-2 py-0.5 rounded hover:bg-neutral-100 disabled:opacity-30">上一页</button>
                <span>{page + 1} / {totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="px-2 py-0.5 rounded hover:bg-neutral-100 disabled:opacity-30">下一页</button>
              </div>
            </div>
          </div>
        )}
      </DrawerShell>
    </ResizablePanel>
  )
}
