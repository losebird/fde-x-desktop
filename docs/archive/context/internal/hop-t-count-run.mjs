/**
 * One-off hop/t count evidence — read-only Noco :13000 meta.count
 */
import { readFile, writeFile } from 'node:fs/promises'

const BASE = 'http://127.0.0.1:13000'
const OUT = new URL('./hop-t-count-queries.json', import.meta.url)

const token = JSON.parse(await readFile('/Users/zxz/.dsh-fde-x/lan-assist/secrets.json', 'utf8')).lookupToken

async function list(resource, { filter, page = 1, pageSize = 1, fields } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filter) params.set('filter', JSON.stringify(filter))
  if (fields) params.set('fields', fields)
  const res = await fetch(`${BASE}/api/${resource}:list?${params}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${resource} ${res.status} ${JSON.stringify(body)}`)
  return body
}

async function metaCount(resource, filter) {
  const body = await list(resource, { filter, pageSize: 1 })
  const c = body?.meta?.count ?? body?.meta?.total
  return Number(c)
}

async function listAllIds(resource, filter, idField = 'id') {
  const pageSize = 200
  let page = 1
  const out = []
  for (;;) {
    const body = await list(resource, { filter, page, pageSize, fields: idField })
    const rows = Array.isArray(body?.data) ? body.data : []
    for (const row of rows) {
      const id = row?.[idField] ?? row?.id
      if (id != null && String(id).trim()) out.push(String(id))
    }
    const total = Number(body?.meta?.count ?? body?.meta?.total ?? 0)
    if (rows.length < pageSize || out.length >= total) break
    page += 1
    if (page > 500) throw new Error('pagination guard')
  }
  return out
}

async function listAllRows(resource, filter, fields) {
  const pageSize = 200
  let page = 1
  const out = []
  for (;;) {
    const body = await list(resource, { filter, page, pageSize, fields })
    const rows = Array.isArray(body?.data) ? body.data : []
    out.push(...rows)
    const total = Number(body?.meta?.count ?? body?.meta?.total ?? 0)
    if (rows.length < pageSize || out.length >= total) break
    page += 1
    if (page > 500) throw new Error('pagination guard')
  }
  return out
}

const poIds = await listAllIds('biz_purchase_orders')
const ticketIds = await listAllIds('biz_tickets')

const queries = []

function record(name, resource, filter, extra = {}) {
  return metaCount(resource, filter).then((count) => {
    queries.push({ name, resource, filter, count, ...extra })
    return count
  })
}

// --- full downstream tables ---
await record('receipts_full', 'biz_purchase_receipts', {})
await record('po_items_full', 'biz_purchase_order_items', {})
await record('ticket_logs_full', 'biz_ticket_logs', {})
await record('po_full', 'biz_purchase_orders', {})
await record('departments_full', 'departments', {})
await record('users_full', 'users', {})

// --- relation $notEmpty on child FK (published graph field on child) ---
await record('receipts_purchaseOrder_notEmpty', 'biz_purchase_receipts', { purchaseOrderId: { $notEmpty: true } })
await record('po_items_purchaseOrder_notEmpty', 'biz_purchase_order_items', { purchaseOrderId: { $notEmpty: true } })
await record('ticket_logs_ticket_notEmpty', 'biz_ticket_logs', { ticketId: { $notEmpty: true } })

// alternate FK column names if schema uses purchaseOrder not purchaseOrderId
for (const fk of ['purchaseOrder', 'purchaseOrderId']) {
  await record(`receipts_${fk}_notEmpty`, 'biz_purchase_receipts', { [fk]: { $notEmpty: true } }).catch(() => null)
  await record(`po_items_${fk}_notEmpty`, 'biz_purchase_order_items', { [fk]: { $notEmpty: true } }).catch(() => null)
}
for (const fk of ['ticket', 'ticketId']) {
  await record(`ticket_logs_${fk}_notEmpty`, 'biz_ticket_logs', { [fk]: { $notEmpty: true } }).catch(() => null)
}

// --- hop: child rows whose FK in all upstream ids ---
await record('receipts_hop_po_ids_in', 'biz_purchase_receipts', { purchaseOrderId: { $in: poIds } })
await record('po_items_hop_po_ids_in', 'biz_purchase_order_items', { purchaseOrderId: { $in: poIds } })
await record('ticket_logs_hop_ticket_ids_in', 'biz_ticket_logs', { ticketId: { $in: ticketIds } })

// Departments → Users (members / owners / mainDepartment on users side too)
for (const fk of ['members', 'owners', 'mainDepartment', 'mainDepartmentId', 'department', 'departmentId']) {
  await record(`users_${fk}_notEmpty`, 'users', { [fk]: { $notEmpty: true } }).catch(() => null)
  await record(`departments_${fk}_notEmpty`, 'departments', { [fk]: { $notEmpty: true } }).catch(() => null)
}

// --- diff rows: in notEmpty set but not in hop $in (orphan FK or batch miss) ---
const receiptHop = await listAllRows(
  'biz_purchase_receipts',
  { purchaseOrderId: { $notEmpty: true } },
  'id,receiptNo,purchaseOrderId,updatedAt',
)
const receiptOrphans = receiptHop.filter((r) => !poIds.includes(String(r.purchaseOrderId)))
const receiptMissingFromHop = receiptHop.filter((r) => poIds.includes(String(r.purchaseOrderId)))
// receipts with PO id not in set
const hopReceiptCount = await metaCount('biz_purchase_receipts', { purchaseOrderId: { $in: poIds } })
const notEmptyReceiptCount = await metaCount('biz_purchase_receipts', { purchaseOrderId: { $notEmpty: true } })

const logHop = await listAllRows(
  'biz_ticket_logs',
  { ticketId: { $notEmpty: true } },
  'id,ticketId,updatedAt',
)
const ticketIdSet = new Set(ticketIds)
const logOrphans = logHop.filter((r) => !ticketIdSet.has(String(r.ticketId)))
const hopLogCount = await metaCount('biz_ticket_logs', { ticketId: { $in: ticketIds } })
const notEmptyLogCount = await metaCount('biz_ticket_logs', { ticketId: { $notEmpty: true } })

// PO items: compare items o2m vs purchaseOrderId
const itemsNotEmpty = await metaCount('biz_purchase_order_items', { purchaseOrderId: { $notEmpty: true } })
const itemsHop = await metaCount('biz_purchase_order_items', { purchaseOrderId: { $in: poIds } })
const itemOrphans = (
  await listAllRows('biz_purchase_order_items', { purchaseOrderId: { $notEmpty: true } }, 'id,purchaseOrderId')
).filter((r) => !poIds.includes(String(r.purchaseOrderId)))

// If hop uses parent receipts association — count receipts linked via invalid PO
const diff = {
  poIdCount: poIds.length,
  ticketIdCount: ticketIds.length,
  receipts: {
    notEmpty: notEmptyReceiptCount,
    hopIn: hopReceiptCount,
    delta_notEmpty_minus_hop: notEmptyReceiptCount - hopReceiptCount,
    orphanFkRows: receiptOrphans.slice(0, 20),
    orphanFkCount: receiptOrphans.length,
  },
  poItems: {
    notEmpty: itemsNotEmpty,
    hopIn: itemsHop,
    delta: itemsNotEmpty - itemsHop,
    orphanFkRows: itemOrphans.slice(0, 20),
    orphanFkCount: itemOrphans.length,
  },
  ticketLogs: {
    notEmpty: notEmptyLogCount,
    hopIn: hopLogCount,
    delta_notEmpty_minus_hop: notEmptyLogCount - hopLogCount,
    orphanFkRows: logOrphans.slice(0, 20),
    orphanFkCount: logOrphans.length,
  },
}

// Detailed orphan rows with ticket no if possible
if (logOrphans.length) {
  const orphanIds = [...new Set(logOrphans.map((r) => r.ticketId))]
  diff.ticketLogs.orphanTicketIds = orphanIds
}

if (receiptOrphans.length) {
  diff.receipts.orphanPurchaseOrderIds = [...new Set(receiptOrphans.map((r) => r.purchaseOrderId))]
}

await writeFile(OUT, JSON.stringify({ at: new Date().toISOString(), queries, diff }, null, 2))
console.log(JSON.stringify({ queries: queries.map((q) => ({ name: q.name, count: q.count })), diff }, null, 2))
