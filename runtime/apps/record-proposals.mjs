import { appIsTrashed, getAppById } from './repository.mjs'
import { getRecord, patchRecord } from './records.mjs'
import { decideProposal, openProposal } from '../proposals/commit.mjs'

const RECORD_PROPOSAL_ACTION = 'app.record.propose'

const RESERVED_KEYS = new Set(['id', 'rid', 'workspace', 'workspaceCwd'])

function expectedVersion(patches) {
  if (patches.length === 1) return String(patches[0].base.updated_at)
  return JSON.stringify(Object.fromEntries(patches.map((patch) => [patch.rid, patch.base.updated_at])))
}

function recordPatches(spec, entity, rows) {
  const entities = Array.isArray(spec?.entities) ? spec.entities : []
  const ent = entities.find((item) => item && item.name === entity)
  if (!ent || !Array.isArray(ent.fields)) return null
  if (!Array.isArray(rows) || rows.length === 0) return null
  const allowed = new Set(ent.fields.map((field) => field.name))
  const patches = []
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null
    const rid = typeof row.id === 'string' && row.id
      ? row.id
      : typeof row.rid === 'string' && row.rid
        ? row.rid
        : ''
    if (!rid) return null
    const fields = {}
    for (const [key, value] of Object.entries(row)) {
      if (RESERVED_KEYS.has(key) || !allowed.has(key)) continue
      fields[key] = value
    }
    if (Object.keys(fields).length === 0) return null
    patches.push({ rid, fields })
  }
  return patches
}

function recordDomain(opts) {
  return {
    action: RECORD_PROPOSAL_ACTION,
    confirmAction: 'app.record.confirm',
    rejectAction: 'app.record.reject',
    actorId: opts.actorId,
    correlationId: opts.correlationId,
    workspaceId: opts.workspaceId,
    // A null base on a live record used to close as stale_record.
    reasons: { missing: 'record_missing', moved: 'stale_record', appeared: 'stale_record' },
    load(db, plan) {
      const app = getAppById(db, plan.appId, opts.workspaceId)
      if (!app || app.status !== 'active' || appIsTrashed(app)) return { hold: true }
      const versions = []
      for (const patch of plan.patches) {
        const current = getRecord(db, app.spec, plan.entity, plan.workspaceCwd, patch.rid)
        versions.push({ current: current ? current.updated_at : null, base: patch.base })
      }
      return { versions }
    },
    apply(db, plan) {
      const app = getAppById(db, plan.appId, opts.workspaceId)
      for (const patch of plan.patches) {
        const row = patchRecord(db, app.spec, plan.entity, plan.workspaceCwd, patch.rid, patch.fields)
        if (!row) return { applied: false }
      }
      return { applied: true, details: { patches: plan.patches } }
    },
  }
}

export function proposeRecordUpdate(db, input) {
  const drafted = recordPatches(input.app.spec, input.entity, input.rows)
  if (!drafted) return { ok: false, error: 'validation_error', message: '更新提案需要记录和字段' }
  const patches = []
  for (const patch of drafted) {
    const existing = getRecord(db, input.app.spec, input.entity, input.workspaceCwd, patch.rid)
    if (!existing) return { ok: false, error: 'not_found', message: '记录不存在' }
    patches.push({
      rid: patch.rid,
      fields: patch.fields,
      base: { updated_at: existing.updated_at },
    })
  }
  const plan = {
    kind: 'app.record.propose',
    appId: input.app.id,
    slug: String(input.app.spec.slug),
    entity: input.entity,
    workspaceCwd: input.workspaceCwd,
    patches,
  }
  const targetRef = patches.length === 1
    ? `fde://workstation/app/${plan.slug}/${input.entity}/${patches[0].rid}`
    : `fde://workstation/app/${input.app.id}`
  return openProposal(db, {
    workspaceId: input.workspaceId,
    appId: input.app.id,
    actorId: input.actorId,
    targetRef,
    action: RECORD_PROPOSAL_ACTION,
    expectedVersion: expectedVersion(patches),
    plan,
    correlationId: input.correlationId,
  })
}

export function confirmRecordProposal(db, operationId, opts = {}) {
  return decideProposal(db, operationId, 'confirm', recordDomain(opts))
}

export function rejectRecordProposal(db, operationId, opts = {}) {
  return decideProposal(db, operationId, 'reject', recordDomain(opts))
}
