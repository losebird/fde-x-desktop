import './support/no-stray-processes.mjs'
import { register } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

await register(new URL('./src-alias-loader.mjs', import.meta.url))
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, insertBizSurface, listBizSurfaces } from '../db.mjs'
import { applyMaterialize } from '../apps/materialize.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { getRecord, insertRecord, listRecords } from '../apps/records.mjs'
import { getDocument, putDocument } from '../apps/documents.mjs'
import { createBriefingRun, getLatestBriefing, getOrCreateDefinition } from '../briefing/store.mjs'
import { shouldRunOnOpen } from '../briefing/scheduler.mjs'
import { configureEventBus, emit, listRecentEvents } from '../events.mjs'
import { canonicalWorkspaceCwd } from '../cwd.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const migrations = join(repoRoot, 'runtime/migrations')

function openTemp(name) {
  return openDatabase(`/tmp/fde-cwd-residual-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`, migrations)
}

function registerWorkspace(db, id, cwd) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES (?, 'cwd', '', 'active', ?, ?, ?)
  `).run(id, JSON.stringify({ cwd }), now, now)
}

test('canonical workspace cwd keeps root and drive root', () => {
  assert.equal(canonicalWorkspaceCwd('/'), '/')
  assert.equal(canonicalWorkspaceCwd('///'), '/')
  assert.equal(canonicalWorkspaceCwd('C:\\'), 'C:/')
  assert.equal(canonicalWorkspaceCwd('c:/'), 'C:/')
  assert.equal(canonicalWorkspaceCwd('C:/'), 'C:/')
  assert.equal(canonicalWorkspaceCwd('c:\\proj\\app\\'), 'C:/proj/app')
  assert.equal(canonicalWorkspaceCwd('/tmp/ws/'), '/tmp/ws')
  assert.equal(canonicalWorkspaceCwd('工作台'), '')
})

test('records documents briefings and biz surfaces match stored cwd spellings without merging rows', () => {
  const db = openTemp('cols')
  applyMaterialize(db, SUPPLIER_VISITS_SPEC)
  const bare = '/tmp/fde-cwd-residual-ws'
  const slash = `${bare}/`
  const legacy = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', slash, {
    supplier: '旧',
    visit_date: '2026-10-01',
    status: '计划',
  })
  const listed = listRecords(db, SUPPLIER_VISITS_SPEC, 'visit', bare)
  assert.equal(listed.total, 1)
  assert.equal(listed.rows[0].id, legacy.id)
  assert.equal(getRecord(db, SUPPLIER_VISITS_SPEC, 'visit', bare, legacy.id).id, legacy.id)
  const storedVisit = db.prepare('SELECT workspace_cwd FROM "app_supplier-visits__visit" WHERE id = ?').get(legacy.id)
  assert.equal(storedVisit.workspace_cwd, slash)
  const again = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', bare, {
    supplier: '新',
    visit_date: '2026-10-02',
    status: '计划',
  })
  const both = listRecords(db, SUPPLIER_VISITS_SPEC, 'visit', slash)
  assert.equal(both.total, 2)
  assert.deepEqual(both.rows.map((row) => row.id).sort(), [legacy.id, again.id].sort())

  const winLegacy = insertRecord(db, SUPPLIER_VISITS_SPEC, 'visit', 'C:\\data\\ledger\\', {
    supplier: '盘',
    visit_date: '2026-10-03',
    status: '计划',
  })
  const winList = listRecords(db, SUPPLIER_VISITS_SPEC, 'visit', 'c:/data/ledger')
  assert.equal(winList.rows.some((row) => row.id === winLegacy.id), true)
  const storedWin = db.prepare('SELECT workspace_cwd FROM "app_supplier-visits__visit" WHERE id = ?').get(winLegacy.id)
  assert.equal(storedWin.workspace_cwd, 'C:\\data\\ledger\\')

  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO business_apps
      (id, workspace_id, name, app_kind, status, current_revision, definition_json, created_at, updated_at)
    VALUES ('app_cwd_residual', 'ws_personal', 'cwd', 'generated', 'active', 1, '{}', ?, ?)
  `).run(now, now)
  db.prepare(`
    INSERT INTO app_documents (id, app_id, slug, workspace_cwd, doc_key, json, updated_at)
    VALUES ('adoc_slash', 'app_cwd_residual', 'cwd', ?, 'note', ?, ?)
  `).run(slash, JSON.stringify({ v: 1 }), now)
  assert.deepEqual(getDocument(db, { appId: 'app_cwd_residual', workspaceCwd: bare, key: 'note', workspaceId: 'ws_personal' }), { v: 1 })
  assert.equal(
    db.prepare('SELECT workspace_cwd FROM app_documents WHERE id = ?').get('adoc_slash').workspace_cwd,
    slash,
  )
  putDocument(db, {
    appId: 'app_cwd_residual',
    slug: 'cwd',
    workspaceCwd: bare,
    key: 'note',
    workspaceId: 'ws_personal',
    value: { v: 3 },
  })
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM app_documents').get().n, 1)
  assert.equal(
    db.prepare('SELECT workspace_cwd FROM app_documents WHERE id = ?').get('adoc_slash').workspace_cwd,
    slash,
  )
  assert.deepEqual(getDocument(db, { appId: 'app_cwd_residual', workspaceCwd: slash, key: 'note', workspaceId: 'ws_personal' }), { v: 3 })
  db.prepare(`
    INSERT INTO app_documents (id, app_id, slug, workspace_cwd, doc_key, json, updated_at)
    VALUES ('adoc_bare', 'app_cwd_residual', 'cwd', ?, 'note', ?, ?)
  `).run(bare, JSON.stringify({ v: 2 }), now)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM app_documents WHERE doc_key = ?').get('note').n, 2)
  assert.deepEqual(getDocument(db, { appId: 'app_cwd_residual', workspaceCwd: slash, key: 'note', workspaceId: 'ws_personal' }), { v: 2 })
  putDocument(db, {
    appId: 'app_cwd_residual',
    slug: 'cwd',
    workspaceCwd: slash,
    key: 'note',
    workspaceId: 'ws_personal',
    value: { v: 4 },
  })
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM app_documents WHERE doc_key = ?').get('note').n, 2)
  assert.equal(JSON.parse(db.prepare('SELECT json FROM app_documents WHERE id = ?').get('adoc_slash').json).v, 3)
  assert.equal(JSON.parse(db.prepare('SELECT json FROM app_documents WHERE id = ?').get('adoc_bare').json).v, 4)

  registerWorkspace(db, 'ws_cwd_residual', bare)
  const definition = getOrCreateDefinition(db, bare)
  const slashRun = createBriefingRun(db, { definitionId: definition.id, workspaceCwd: slash })
  assert.equal(shouldRunOnOpen(db, bare), false)
  assert.equal(getLatestBriefing(db, bare).id, slashRun.id)
  assert.equal(
    db.prepare('SELECT workspace_cwd FROM briefings WHERE id = ?').get(slashRun.id).workspace_cwd,
    slash,
  )
  const bareRun = createBriefingRun(db, { definitionId: definition.id, workspaceCwd: bare })
  db.prepare('UPDATE briefings SET generated_at = ? WHERE id = ?').run(new Date(Date.now() + 60_000).toISOString(), bareRun.id)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM briefings').get().n, 2)
  assert.equal(getLatestBriefing(db, slash).id, bareRun.id)
  assert.equal(
    db.prepare('SELECT workspace_cwd FROM briefings WHERE id = ?').get(slashRun.id).workspace_cwd,
    slash,
  )

  const surfaceId = insertBizSurface(db, {
    workspaceCwd: 'C:\\biz\\board\\',
    kind: '采购单',
    action: '现查',
    rowCount: 1,
  })
  const surfaces = listBizSurfaces(db, 'c:/biz/board', 10)
  assert.equal(surfaces.some((row) => row.id === surfaceId), true)
  assert.equal(
    db.prepare('SELECT workspace_cwd FROM biz_surfaces WHERE id = ?').get(surfaceId).workspace_cwd,
    'C:\\biz\\board\\',
  )
  insertBizSurface(db, {
    workspaceCwd: 'c:/biz/board',
    kind: '采购单',
    action: '现查',
    rowCount: 2,
  })
  assert.equal(listBizSurfaces(db, 'C:/biz/board/', 10).length, 2)
  db.close()
})

test('listRecentEvents keeps the root path', () => {
  const db = openTemp('root')
  configureEventBus(db)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO outbox_events
      (id, event_type, schema_version, source_ref, subject_ref, correlation_id,
       payload_json, occurred_at, available_at, ts, workspace_cwd, source, delivered)
    VALUES ('evt_root', 'task.changed', 1, 'fde://legacy', NULL, 'evt_root',
            '{}', ?, ?, 1, '/', 'bff', 0)
  `).run(now, now)
  db.prepare(`
    INSERT INTO outbox_events
      (id, event_type, schema_version, source_ref, subject_ref, correlation_id,
       payload_json, occurred_at, available_at, ts, workspace_cwd, source, delivered)
    VALUES ('evt_other', 'task.changed', 1, 'fde://legacy', NULL, 'evt_other',
            '{}', ?, ?, 2, '/tmp/ws', 'bff', 0)
  `).run(now, now)
  assert.deepEqual(listRecentEvents(db, { workspaceCwd: '/' }).map((item) => item.id), ['evt_root'])
  assert.deepEqual(listRecentEvents(db, { workspaceCwd: '/tmp/ws/' }).map((item) => item.id), ['evt_other'])
  const freshRoot = emit('task.changed', { id: 'fresh-root' }, { workspaceCwd: '/' })
  const freshOther = emit('task.changed', { id: 'fresh-other' }, { workspaceCwd: '/tmp/ws/' })
  assert.equal(db.prepare('SELECT workspace_cwd FROM outbox_events WHERE id = ?').get(freshRoot).workspace_cwd, '/')
  assert.equal(db.prepare('SELECT workspace_cwd FROM outbox_events WHERE id = ?').get(freshOther).workspace_cwd, '/tmp/ws')
  assert.deepEqual(listRecentEvents(db, { workspaceCwd: '/' }).map((item) => item.id), ['evt_root', freshRoot])
  db.close()
})

test('listRecentEvents matches older Windows drive spellings', () => {
  const db = openTemp('win-old')
  configureEventBus(db)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO outbox_events
      (id, event_type, schema_version, source_ref, subject_ref, correlation_id,
       payload_json, occurred_at, available_at, ts, workspace_cwd, source, delivered)
    VALUES ('evt_legacy_slash', 'task.changed', 1, 'fde://legacy', NULL, 'evt_legacy_slash',
            '{}', ?, ?, 1, 'C:\\proj\\', 'bff', 0)
  `).run(now, now)
  db.prepare(`
    INSERT INTO outbox_events
      (id, event_type, schema_version, source_ref, subject_ref, correlation_id,
       payload_json, occurred_at, available_at, ts, workspace_cwd, source, delivered)
    VALUES ('evt_legacy_lower', 'task.changed', 1, 'fde://legacy', NULL, 'evt_legacy_lower',
            '{}', ?, ?, 2, 'c:/proj', 'bff', 0)
  `).run(now, now)
  db.prepare(`
    INSERT INTO outbox_events
      (id, event_type, schema_version, source_ref, subject_ref, correlation_id,
       payload_json, occurred_at, available_at, ts, workspace_cwd, source, delivered)
    VALUES ('evt_legacy_drive', 'task.changed', 1, 'fde://legacy', NULL, 'evt_legacy_drive',
            '{}', ?, ?, 3, 'C:\\', 'bff', 0)
  `).run(now, now)
  const proj = listRecentEvents(db, { workspaceCwd: 'c:/proj' }).map((item) => item.id)
  assert.deepEqual(proj.sort(), ['evt_legacy_lower', 'evt_legacy_slash'].sort())
  assert.deepEqual(listRecentEvents(db, { workspaceCwd: 'c:/' }).map((item) => item.id), ['evt_legacy_drive'])
  assert.equal(
    db.prepare('SELECT workspace_cwd FROM outbox_events WHERE id = ?').get('evt_legacy_slash').workspace_cwd,
    'C:\\proj\\',
  )
  db.close()
})

test('new events store a C:/ workspace', () => {
  const db = openTemp('win-new')
  configureEventBus(db)
  const fresh = emit('task.changed', { id: 'fresh' }, { workspaceCwd: 'C:\\proj\\' })
  const drive = emit('task.changed', { id: 'drive' }, { workspaceCwd: 'c:\\' })
  assert.equal(db.prepare('SELECT workspace_cwd FROM outbox_events WHERE id = ?').get(fresh).workspace_cwd, 'C:/proj')
  assert.equal(db.prepare('SELECT workspace_cwd FROM outbox_events WHERE id = ?').get(drive).workspace_cwd, 'C:/')
  assert.deepEqual(listRecentEvents(db, { workspaceCwd: 'c:/proj/' }).map((item) => item.id), [fresh])
  assert.deepEqual(listRecentEvents(db, { workspaceCwd: 'C:/' }).map((item) => item.id), [drive])
  db.close()
})

test('biz surface and kind list caches share one cwd key', async () => {
  const memory = new Map()
  globalThis.sessionStorage = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null },
    setItem(key, value) { memory.set(key, String(value)) },
    removeItem(key) { memory.delete(key) },
  }
  const { rememberBizSurfaceSheet, peekBizSurfaceSheet, listRememberedSurfaceSheets } = await import('../../src/lib/biz-surface-cache.ts')
  const { rememberBizKindListSheet, peekBizKindListSheet, listBizKindListSnapshots } = await import('../../src/lib/biz-kind-list-cache.ts')
  rememberBizSurfaceSheet('C:\\proj\\', 'surf-1', { rows: [{ no: '1' }] }, '连接器')
  assert.equal(peekBizSurfaceSheet('c:/proj', 'surf-1').sheet.rows[0].no, '1')
  rememberBizSurfaceSheet('/tmp/ws/', 'surf-2', { rows: [{ no: '2' }] })
  rememberBizSurfaceSheet('/tmp/ws', 'surf-2', { rows: [{ no: '3' }] })
  const surfaces = listRememberedSurfaceSheets('/tmp/ws/')
  assert.equal(surfaces.filter((row) => row.surfaceId === 'surf-2').length, 1)
  assert.equal(surfaces.find((row) => row.surfaceId === 'surf-2').sheet.rows[0].no, '3')
  assert.equal(surfaces.find((row) => row.surfaceId === 'surf-2').workspaceCwd, '/tmp/ws')
  assert.equal(listRememberedSurfaceSheets('c:/proj').find((row) => row.surfaceId === 'surf-1').workspaceCwd, 'C:/proj')

  const kindSheet = {
    kind: '采购单',
    action: '现查',
    rows: [{ no: 'b' }],
  }
  rememberBizKindListSheet('C:\\proj\\', {
    kind: '采购单',
    action: '现查',
    rows: [{ no: 'a' }],
  })
  rememberBizKindListSheet('c:/proj/', kindSheet)
  const { listQueryFingerprint } = await import('../../src/lib/biz-list-query.ts')
  assert.equal(peekBizKindListSheet('C:/proj', '采购单', listQueryFingerprint(kindSheet)).sheet.rows[0].no, 'b')
  assert.equal(listBizKindListSnapshots('C:/proj').length, 1)
  assert.equal(listBizKindListSnapshots('c:/proj/').length, 1)
  assert.equal(listBizKindListSnapshots('C:/proj')[0].workspaceCwd, 'C:/proj')
  assert.equal(JSON.parse(sessionStorage.getItem('fde:biz:kind-list-cache')).length, 1)
})

test('im normalizeCwd follows canonicalWorkspaceCwd', async () => {
  const { normalizeCwd } = await import('../../src/lib/im-letter-home.ts')
  const samples = ['C:\\', 'c:/', 'c:\\foo\\bar\\', '/tmp/a/', '/', '///', '', '工作台宣传图']
  for (const sample of samples) {
    assert.equal(normalizeCwd(sample), canonicalWorkspaceCwd(sample), sample)
  }
  assert.equal(normalizeCwd('C:\\'), 'C:/')
  assert.equal(normalizeCwd('c:/foo/'), 'C:/foo')
  assert.equal(normalizeCwd('/'), '/')
  assert.equal(normalizeCwd('工作台宣传图'), '')
})
