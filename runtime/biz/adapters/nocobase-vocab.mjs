/**
 * NocoBase (and compatible) collection list → workspace vocab concepts + relations.
 * No hardcoded kind labels; everything comes from live collection metadata.
 */

const REL_PARENT_TO_CHILD = /^(m2o|o2o|belongsTo)$/i
const REL_CHILD_TO_PARENT = /^(o2m|hasMany|m2m|belongsToMany)$/i
const SKIP_FIELDS = /^(id|createdAt|updatedAt|createdBy|updatedBy|createdById|updatedById)$/i
const TICKET_HINTS = /^(code|no|number|orderNo|order_no|bizNo|ticket|sn|serial)$/i

/** Shared gate action slots (spoken layer), not business table names. */
export const READ_ACTION = '现查'
export const WRITE_ACTIONS = ['改行', '删除']
export const CREATE_ACTION = '新建'
export const APPROVE_ACTION = '过审'

function slugId(resource) {
  const raw = String(resource || '').trim()
  if (!raw) return ''
  return raw.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || raw
}

function fieldTitle(field) {
  if (!field || typeof field !== 'object') return ''
  const ui = field.uiSchema && typeof field.uiSchema === 'object' ? field.uiSchema : {}
  return String(ui.title || field.title || field.label || '').trim()
}

function fieldInterface(field) {
  return String((field && (field.interface || field.type)) || '').trim()
}

function isRelationField(field) {
  const iface = fieldInterface(field)
  return REL_PARENT_TO_CHILD.test(iface) || REL_CHILD_TO_PARENT.test(iface)
}

function isWritableField(field) {
  const name = String((field && field.name) || '').trim()
  if (!name || SKIP_FIELDS.test(name) || /Id$|_id$/i.test(name)) return false
  if (isRelationField(field)) return false
  return true
}

function pickTicketField(fields) {
  for (const field of fields) {
    const name = String((field && field.name) || '').trim()
    if (name && TICKET_HINTS.test(name)) return name
  }
  for (const field of fields) {
    const name = String((field && field.name) || '').trim()
    if (name && fieldInterface(field) === 'input') return name
  }
  return ''
}

function hasStatusEnum(fields) {
  for (const field of fields) {
    const name = String((field && field.name) || '').trim()
    if (!/status/i.test(name)) continue
    const enums = field.enum || (field.uiSchema && field.uiSchema.enum)
    if (Array.isArray(enums) && enums.length) return true
  }
  return false
}

function shapeFields(fields, ticketField) {
  const out = []
  const seen = new Set()
  if (ticketField) {
    out.push(ticketField)
    seen.add(ticketField)
  }
  for (const field of fields) {
    const name = String((field && field.name) || '').trim()
    if (!name || seen.has(name) || !isWritableField(field)) continue
    out.push(fieldTitle(field) || name)
    seen.add(name)
  }
  return out.slice(0, 24)
}

/** Display label (词表 fields / ui title) → NocoBase field name */
export function buildFieldLabelMap(fields, ticketField) {
  const map = {}
  const rows = Array.isArray(fields) ? fields : []
  if (ticketField) {
    const ticket = String(ticketField).trim()
    const row = rows.find((item) => String((item && item.name) || '').trim() === ticket)
    const title = fieldTitle(row)
    map[ticket] = ticket
    if (title) map[title] = ticket
  }
  for (const field of rows) {
    const name = String((field && field.name) || '').trim()
    if (!name || !isWritableField(field)) continue
    const title = fieldTitle(field)
    map[name] = name
    if (title) map[title] = name
  }
  return map
}

function canForCollection(fields) {
  const can = [READ_ACTION]
  const writable = fields.some((field) => isWritableField(field))
  if (writable) {
    for (const action of WRITE_ACTIONS) {
      if (!can.includes(action)) can.push(action)
    }
    if (!can.includes(CREATE_ACTION)) can.push(CREATE_ACTION)
  }
  if (hasStatusEnum(fields) && !can.includes(APPROVE_ACTION)) can.push(APPROVE_ACTION)
  return can
}

/**
 * @param {Array<Record<string, unknown>>} collections
 * @param {{ catalogVersion?: string }} [opts]
 */
export function buildVocabFromNocoCollections(collections, opts = {}) {
  const rows = Array.isArray(collections) ? collections : []
  const catalogVersion = String(opts.catalogVersion || '').trim()
  const kindByResource = new Map()
  const concepts = []

  for (const row of rows) {
    const resource = String((row && (row.name || row.resource)) || '').trim()
    if (!resource || resource.startsWith('attachments')) continue
    const label = String((row && row.title) || '').trim() || resource
    kindByResource.set(resource, label)
  }

  const globalRelations = []

  for (const row of rows) {
    const resource = String((row && (row.name || row.resource)) || '').trim()
    if (!resource || !kindByResource.has(resource)) continue
    const label = kindByResource.get(resource)
    const fields = Array.isArray(row.fields) ? row.fields : []
    const ticketField = pickTicketField(fields)
    const relations = []

    for (const field of fields) {
      const target = String((field && field.target) || '').trim()
      if (!target || !kindByResource.has(target)) continue
      const parentKind = kindByResource.get(target)
      const childKind = label
      const iface = fieldInterface(field)
      const fk = String((field && field.name) || '').trim()
      if (REL_PARENT_TO_CHILD.test(iface) && parentKind && childKind && fk) {
        const rel = { from: parentKind, to: childKind, field: fk }
        relations.push(rel)
        globalRelations.push(rel)
      }
      if (REL_CHILD_TO_PARENT.test(iface) && parentKind && childKind) {
        const rel = { from: childKind, to: parentKind, field: fk || `${slugId(target)}Id` }
        if (rel.field) {
          relations.push(rel)
          globalRelations.push(rel)
        }
      }
    }

    const fieldLabels = buildFieldLabelMap(fields, ticketField)
    const concept = {
      id: slugId(resource),
      label,
      resource,
      fields: shapeFields(fields, ticketField),
      can: canForCollection(fields),
      ...(ticketField ? { ticketField } : {}),
      ...(Object.keys(fieldLabels).length ? { fieldLabels } : {}),
      ...(relations.length ? { relations } : {}),
      ...(catalogVersion ? { catalogVersion } : {}),
    }
    concepts.push(concept)
  }

  const dedupedRelations = []
  const seen = new Set()
  for (const rel of globalRelations) {
    const key = `${rel.from}\0${rel.to}\0${rel.field || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    dedupedRelations.push(rel)
  }

  return { concepts, relations: dedupedRelations, catalogVersion }
}

/**
 * @param {{ baseUrl: string, token: string, fetchImpl?: typeof fetch }} conn
 */
export async function fetchNocoBaseCollections(conn) {
  const baseUrl = String(conn.baseUrl || '').replace(/\/+$/, '')
  const token = String(conn.token || '').trim()
  const fetchImpl = conn.fetchImpl || fetch
  if (!baseUrl || !token) return { ok: false, error: 'NO_CONNECTOR' }
  const url = `${baseUrl}/api/collections:list?paginate=false&fields=name,title,fields`
  const res = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      error: String((body && body.errors && body.errors[0] && body.errors[0].message) || body.message || `HTTP_${res.status}`),
    }
  }
  const data = body && body.data
  const list = Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : [])
  return { ok: true, collections: list }
}
