import { readFile } from 'node:fs/promises'
import { relatedIdBatches } from '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/runtime/vendor-overlays/dsh-lan-assist/lookup.js'

const SECRETS_PATH = '/Users/zxz/.dsh-fde-x/lan-assist/secrets.json'
const NOCO_BASE = 'http://127.0.0.1:13000'

function fkColumn(field) {
  if (!field) return null
  if (field.endsWith('Id')) return field
  return `${field}Id`
}

function isBelongsToMany(field) {
  if (!field || typeof field !== 'object') return false
  const iface = String(field.interface || field.type || '').trim()
  return /^(m2m|belongsToMany)$/i.test(iface)
}

function throughName(field) {
  if (!field || typeof field !== 'object') return ''
  const raw = field.through || field.options?.through
  return String(raw || '').trim()
}

function assocKey(field, key) {
  if (!field || typeof field !== 'object') return ''
  const raw = field[key] ?? field.options?.[key]
  return String(raw || '').trim()
}

function unwrapCell(raw) {
  if (raw == null) return null
  if (typeof raw === 'object') {
    const id = raw.id ?? raw.name
    if (id != null && String(id).trim() !== '') return String(id)
  }
  const s = String(raw).trim()
  return s === '' ? null : s
}

function kindResource(kind, kinds) {
  return kinds.find((row) => row.kind === kind)?.resource || null
}

function childRelationField(kinds, fromKind, toKind) {
  const toRow = kinds.find((row) => row.kind === toKind)
  const onChild = (toRow?.relations || []).find((rel) => rel.from === fromKind && rel.to === toKind)
  return onChild?.field || null
}

export async function createLibraryCountContext(kinds) {
  const secrets = JSON.parse(await readFile(SECRETS_PATH, 'utf8'))
  const token = String(secrets.lookupToken || '')
  const headers = { accept: 'application/json', authorization: `Bearer ${token}` }

  const collRes = await fetch(
    `${NOCO_BASE}/api/collections:list?paginate=false&fields=name,title,fields`,
    { headers },
  )
  const collBody = await collRes.json().catch(() => ({}))
  if (!collRes.ok) throw new Error(`collections:list ${collRes.status}`)
  const collectionsByName = new Map()
  for (const row of collBody.data || []) {
    if (row?.name) collectionsByName.set(String(row.name), row)
  }

  async function nocoMeta(resource, filter) {
    const q = filter && Object.keys(filter).length ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const res = await fetch(`${NOCO_BASE}/api/${resource}:list?page=1&pageSize=1${q}`, { headers })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return null
    const count = Number(body?.meta?.count)
    return Number.isFinite(count) ? count : null
  }

  async function listAllIds(resource) {
    return listAllColumnValues(resource, 'id')
  }

  async function listAllColumnValues(resource, column) {
    const col = String(column || 'id').trim()
    if (!resource || !col) return []
    const pageSize = 200
    let page = 1
    const out = []
    for (;;) {
      const res = await fetch(
        `${NOCO_BASE}/api/${resource}:list?page=${page}&pageSize=${pageSize}&sort=-updatedAt&fields=${encodeURIComponent(col)}`,
        { headers },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) break
      const rows = body.data || []
      for (const row of rows) {
        const cell = unwrapCell(row?.[col])
        if (cell != null) out.push(cell)
      }
      const total = Number(body?.meta?.count ?? 0)
      if (!rows.length || rows.length < pageSize || out.length >= total) break
      page += 1
      if (page > 500) break
    }
    return out
  }

  async function hopLibraryCount(downResource, upResource, fkCol) {
    if (!downResource || !upResource || !fkCol) return null
    const ids = await listAllIds(upResource)
    if (!ids.length) return 0
    let sum = 0
    for (const batch of relatedIdBatches(ids, fkCol)) {
      const clause = batch.length === 1 ? batch[0] : { $in: batch }
      const count = await nocoMeta(downResource, { [fkCol]: clause })
      if (count == null) return null
      sum += count
    }
    return sum
  }

  function associationOnFrom(fromKind, edgeField) {
    const fromResource = kindResource(fromKind, kinds)
    if (!fromResource) return null
    const coll = collectionsByName.get(fromResource)
    const field = (coll?.fields || []).find((row) => String(row?.name || '') === String(edgeField || ''))
    return field || null
  }

  async function m2mLibraryCount(fromKind, toKind, edgeField) {
    const fromResource = kindResource(fromKind, kinds)
    const toResource = kindResource(toKind, kinds)
    const assoc = associationOnFrom(fromKind, edgeField)
    const through = throughName(assoc)
    if (!fromResource || !toResource || !assoc || !isBelongsToMany(assoc) || !through) return null

    const foreignKey = assocKey(assoc, 'foreignKey')
    const otherKey = assocKey(assoc, 'otherKey')
    if (!foreignKey || !otherKey) return null

    const throughTotal = await nocoMeta(through)
    if (throughTotal === 0) return 0
    if (throughTotal == null) return null

    const sourceKey = assocKey(assoc, 'sourceKey') || 'id'
    const sourceValues = new Set(await listAllColumnValues(fromResource, sourceKey))
    if (!sourceValues.size) return 0

    const targetKeys = new Set()
    const fields = encodeURIComponent(`${foreignKey},${otherKey}`)
    let page = 1
    while (page < 500) {
      const res = await fetch(
        `${NOCO_BASE}/api/${through}:list?page=${page}&pageSize=200&sort=-updatedAt&fields=${fields}`,
        { headers },
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return null
      const rows = body.data || []
      for (const row of rows) {
        const src = unwrapCell(row?.[foreignKey])
        if (src == null || !sourceValues.has(src)) continue
        const tgt = unwrapCell(row?.[otherKey])
        if (tgt != null) targetKeys.add(tgt)
      }
      const total = Number(body?.meta?.count ?? 0)
      if (!rows.length || rows.length < 200 || page * 200 >= total) break
      page += 1
    }
    return targetKeys.size
  }

  async function walkFkCount(resource, column) {
    let hit = 0
    let page = 1
    while (page < 400) {
      const res = await fetch(
        `${NOCO_BASE}/api/${resource}:list?page=${page}&pageSize=200&sort=id&fields=${encodeURIComponent(column)}`,
        { headers },
      )
      const body = await res.json()
      const rows = body.data || []
      for (const r of rows) {
        const raw = r?.[column]
        const id = raw && typeof raw === 'object' ? raw.id : raw
        if (id != null && String(id).trim() !== '') hit += 1
      }
      if (!rows.length || rows.length < 200) break
      page += 1
    }
    return hit
  }

  async function libraryCountFor(caseRow, countRow, walkFk) {
    const resource = kindResource(countRow.kind, kinds)
    if (!resource) return null
    const { field, codes, column } = countRow

    if (column === 'managerId') return nocoMeta(resource, { managerId: { $notEmpty: true } })
    if (column === 'parentId') return nocoMeta(resource, { parentId: { $notEmpty: true } })

    if (field && codes?.length === 1) return nocoMeta(resource, { [field]: codes[0] })
    if (field && codes?.length > 1) return nocoMeta(resource, { [field]: { $in: codes } })

    const opt = flattenOptions(caseRow.objects).find((row) => row.kind === countRow.kind)
    if (opt?.field && opt?.code) return nocoMeta(resource, { [opt.field]: opt.code })

    if (caseRow.classId === 'edge') {
      const fromKind = caseRow.objects?.from
      const toKind = caseRow.objects?.to
      const edgeField = caseRow.objects?.field
      const countingDownstream = countRow.kind === toKind

      if (countingDownstream && fromKind && toKind && edgeField) {
        if (column === 'm2m' || isBelongsToMany(associationOnFrom(fromKind, edgeField))) {
          const m2m = await m2mLibraryCount(fromKind, toKind, edgeField)
          if (m2m != null) return m2m
        }

        if (edgeField === 'managedWarehouses') {
          return nocoMeta(resource, { managerId: { $notEmpty: true } })
        }
        if (edgeField === 'product' || edgeField === 'stockMovements') {
          return walkFk(resource, 'product')
        }
        if (edgeField === 'warehouse') {
          return walkFk(resource, 'warehouse')
        }

        const relField = childRelationField(kinds, fromKind, toKind)
        const fkCol = fkColumn(relField)
        if (fkCol) {
          const upResource = kindResource(fromKind, kinds)
          const hop = await hopLibraryCount(resource, upResource, fkCol)
          if (hop != null) return hop
        }
      }

      if (countingDownstream) return null
    }

    if (caseRow.classId === 'enum' && field && caseRow.objects?.say) {
      const enumOpt = flattenOptions(caseRow.objects)[0]
      if (enumOpt?.code) return nocoMeta(resource, { [field]: enumOpt.code })
    }

    if (caseRow.classId === 'edge') return null
    return nocoMeta(resource)
  }

  return { libraryCountFor, nocoMeta, walkFk: walkFkCount }
}

function flattenOptions(objects) {
  const raw = objects?.options || []
  if (!raw.length) return []
  if (Array.isArray(raw[0])) {
    const out = []
    for (const group of raw) for (const opt of group) out.push(opt)
    return out
  }
  return raw
}
