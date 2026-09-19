import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listBusinessApps } from '../db.mjs'
import { openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { activateApp, createAppDraft, findActiveAppBySlug } from '../apps/repository.mjs'
import { insertRecord, listRecords } from '../apps/records.mjs'
import { handleAppsBridge } from '../routes/apps.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/fde-app-tab-cwd'

function uniqueSpec() {
  return {
    ...SUPPLIER_VISITS_SPEC,
    slug: `visits-${Date.now().toString(36)}`,
  }
}

describe('apps workspace identity', () => {
  test('list by cwd finds draft stored on ws_personal', () => {
    const db = openDatabase(`/tmp/fde-apps-ws-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec,
    })
    assert.equal(created.ok, true)
    const listed = listBusinessApps(db, { workspaceId: 'ws_other', workspaceCwd: CWD })
    assert.ok(listed.some((row) => row.id === created.data.appId))
    const miss = listBusinessApps(db, { workspaceId: 'ws_other', workspaceCwd: '/tmp/other' })
    assert.equal(miss.some((row) => row.id === created.data.appId), false)
    db.close()
  })

  test('activate then find by slug+cwd even if workspaceId differs', () => {
    const db = openDatabase(`/tmp/fde-apps-ws2-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec,
    })
    const activated = activateApp(db, created.data.appId)
    assert.equal(activated.kind, 'ok')
    const found = findActiveAppBySlug(db, 'ws_other', spec.slug, CWD)
    assert.ok(found)
    assert.equal(found.id, created.data.appId)
    db.close()
  })

  test('bridge submit returns appId and stores cwd on spec', () => {
    const db = openDatabase(`/tmp/fde-apps-ws3-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const result = handleAppsBridge('app-spec-submit', { spec }, db, CWD)
    assert.equal(result.ok, true)
    assert.ok(result.appId)
    const listed = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD })
    const row = listed.find((item) => item.id === result.appId)
    assert.equal(row.definition._workspaceCwd, CWD)
    db.close()
  })

  test('insert then list still there after activate', () => {
    const db = openDatabase(`/tmp/fde-apps-ws4-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec,
    })
    activateApp(db, created.data.appId)
    insertRecord(db, { ...spec, _workspaceCwd: CWD }, 'visit', CWD, {
      supplier: '北郊仓',
      visit_date: '2026-09-19',
      status: '计划',
    })
    const list = listRecords(db, spec, 'visit', CWD)
    assert.equal(list.total, 1)
    assert.equal(list.rows[0].supplier, '北郊仓')
    db.close()
  })
})
