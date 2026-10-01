import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listBusinessApps, openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import {
  activateApp,
  appIsTrashed,
  createAppDraft,
  findActiveAppBySlug,
  getAppById,
  purgeApp,
  putAppSpec,
  restoreApp,
  trashApp,
} from '../apps/repository.mjs'
import { insertRecord, listRecords } from '../apps/records.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/fde-app-delete-cwd'

function specWith({ name, slug }) {
  return { ...SUPPLIER_VISITS_SPEC, name, slug }
}

function dbNew() {
  return openDatabase(`/tmp/fde-apps-del-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`, join(repoRoot, 'runtime/migrations'))
}

describe('apps trash restore purge', () => {
  test('trash keeps metadata and lists it with deletedAt', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '同名草稿', slug: 'del-a' }),
    })
    assert.equal(created.ok, true)
    const result = trashApp(db, created.data.appId)
    assert.equal(result.kind, 'ok')
    const app = getAppById(db, created.data.appId)
    assert.ok(app)
    assert.equal(app.status, 'draft')
    assert.ok(appIsTrashed(app))
    const listed = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD })
    const row = listed.find((item) => item.id === created.data.appId)
    assert.ok(row)
    assert.ok(String(row.deletedAt || '').trim())
    db.close()
  })

  test('same-name drafts are trashed separately', () => {
    const db = dbNew()
    const one = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '同名草稿', slug: 'del-one' }),
    })
    const two = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '同名草稿', slug: 'del-two' }),
    })
    const gone = trashApp(db, one.data.appId)
    assert.equal(gone.kind, 'ok')
    assert.ok(appIsTrashed(getAppById(db, one.data.appId)))
    const kept = getAppById(db, two.data.appId)
    assert.ok(kept)
    assert.equal(kept.name, '同名草稿')
    assert.equal(kept.status, 'draft')
    assert.equal(appIsTrashed(kept), false)
    db.close()
  })

  test('trash on active keeps status and table rows', () => {
    const db = dbNew()
    const spec = specWith({ name: '运行台账', slug: 'del-live' })
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec,
    })
    assert.equal(activateApp(db, created.data.appId).kind, 'ok')
    insertRecord(db, spec, 'visit', CWD, {
      supplier: '留表',
      visit_date: '2026-09-19',
      status: '计划',
    })
    const result = trashApp(db, created.data.appId)
    assert.equal(result.kind, 'ok')
    const app = getAppById(db, created.data.appId)
    assert.equal(app.status, 'active')
    assert.ok(appIsTrashed(app))
    assert.equal(findActiveAppBySlug(db, 'ws_personal', 'del-live', CWD), null)
    assert.equal(listRecords(db, spec, 'visit', CWD).total, 1)
    db.close()
  })

  test('trash is idempotent', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '再删', slug: 'del-again' }),
    })
    const first = trashApp(db, created.data.appId)
    const second = trashApp(db, created.data.appId)
    assert.equal(first.kind, 'ok')
    assert.equal(second.kind, 'ok')
    assert.equal(second.data.deletedAt, first.data.deletedAt)
    db.close()
  })

  test('restore clears tombstone and does not activate', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '草稿', slug: 'del-restore' }),
    })
    trashApp(db, created.data.appId)
    const result = restoreApp(db, created.data.appId)
    assert.equal(result.kind, 'ok')
    assert.equal(result.data.status, 'draft')
    const app = getAppById(db, created.data.appId)
    assert.equal(app.status, 'draft')
    assert.equal(appIsTrashed(app), false)
    db.close()
  })

  test('restore of live app is not_trashed', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '在用', slug: 'del-not-trash' }),
    })
    const result = restoreApp(db, created.data.appId)
    assert.equal(result.kind, 'not_trashed')
    db.close()
  })

  test('restore refuses when live slug is taken', () => {
    const db = dbNew()
    const one = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '先删', slug: 'del-slug' }),
    })
    const two = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '还在用', slug: 'del-slug' }),
    })
    trashApp(db, one.data.appId)
    assert.equal(activateApp(db, two.data.appId).kind, 'ok')
    const result = restoreApp(db, one.data.appId)
    assert.equal(result.kind, 'slug_taken')
    assert.ok(appIsTrashed(getAppById(db, one.data.appId)))
    db.close()
  })

  test('put and activate refuse trashed apps', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '进桶', slug: 'del-write' }),
    })
    trashApp(db, created.data.appId)
    assert.equal(putAppSpec(db, created.data.appId, { spec: specWith({ name: '进桶', slug: 'del-write' }) }).kind, 'trashed')
    assert.equal(activateApp(db, created.data.appId).kind, 'trashed')
    db.close()
  })

  test('purge only when trashed, then drops tables and metadata', () => {
    const db = dbNew()
    const spec = specWith({ name: '硬删台账', slug: 'del-purge' })
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec,
    })
    activateApp(db, created.data.appId)
    insertRecord(db, spec, 'visit', CWD, {
      supplier: '要删',
      visit_date: '2026-09-19',
      status: '计划',
    })
    const live = purgeApp(db, created.data.appId)
    assert.equal(live.kind, 'not_trashed')
    assert.ok(getAppById(db, created.data.appId))
    assert.equal(trashApp(db, created.data.appId).kind, 'ok')
    const result = purgeApp(db, created.data.appId)
    assert.equal(result.kind, 'ok')
    assert.ok(result.data.dropped.includes('app_del-purge__visit'))
    assert.equal(getAppById(db, created.data.appId), null)
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    ).get('app_del-purge__visit')
    assert.equal(table, undefined)
    db.close()
  })

  test('legacy archived row becomes trashed active', () => {
    const db = dbNew()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO business_apps
        (id, workspace_id, name, app_kind, status, current_revision, definition_json, created_by, created_at, updated_at)
      VALUES (?, 'ws_personal', '旧归档', 'generated', 'archived', 1, '{}', 'actor_local_user', ?, ?)
    `).run('app_legacy_arch', now, now)
    db.exec(`
      UPDATE business_apps
      SET deleted_at = updated_at, status = 'active'
      WHERE status = 'archived'
        AND (deleted_at IS NULL OR deleted_at = '')
    `)
    const app = getAppById(db, 'app_legacy_arch')
    assert.equal(app.status, 'active')
    assert.ok(appIsTrashed(app))
    db.close()
  })
})
