import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listBusinessApps } from '../db.mjs'
import { openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import {
  activateApp,
  archiveApp,
  createAppDraft,
  discardDraftApp,
  getAppById,
  purgeApp,
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

describe('apps delete', () => {
  test('discard draft removes it from list by id', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '同名草稿', slug: 'del-a' }),
    })
    assert.equal(created.ok, true)
    const result = discardDraftApp(db, created.data.appId)
    assert.equal(result.kind, 'ok')
    assert.equal(getAppById(db, created.data.appId), null)
    const listed = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD })
    assert.equal(listed.some((row) => row.id === created.data.appId), false)
    db.close()
  })

  test('same-name drafts are discarded separately', () => {
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
    const gone = discardDraftApp(db, one.data.appId)
    assert.equal(gone.kind, 'ok')
    assert.equal(getAppById(db, one.data.appId), null)
    const kept = getAppById(db, two.data.appId)
    assert.ok(kept)
    assert.equal(kept.name, '同名草稿')
    assert.equal(kept.status, 'draft')
    db.close()
  })

  test('discard refuses active apps', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '运行中', slug: 'del-live' }),
    })
    assert.equal(activateApp(db, created.data.appId).kind, 'ok')
    const result = discardDraftApp(db, created.data.appId)
    assert.equal(result.kind, 'not_draft')
    assert.ok(getAppById(db, created.data.appId))
    db.close()
  })

  test('archive hides from catalog but keeps table rows', () => {
    const db = dbNew()
    const spec = specWith({ name: '归档台账', slug: 'del-arch' })
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec,
    })
    activateApp(db, created.data.appId)
    insertRecord(db, spec, 'visit', CWD, {
      supplier: '留表',
      visit_date: '2026-09-19',
      status: '计划',
    })
    assert.equal(archiveApp(db, created.data.appId), true)
    const app = getAppById(db, created.data.appId)
    assert.equal(app.status, 'archived')
    const listed = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD })
    const row = listed.find((item) => item.id === created.data.appId)
    assert.equal(row.status, 'archived')
    assert.equal(listRecords(db, spec, 'visit', CWD).total, 1)
    db.close()
  })

  test('purge drops tables and metadata', () => {
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

  test('purge refuses drafts', () => {
    const db = dbNew()
    const created = createAppDraft(db, {
      workspaceId: 'ws_personal',
      workspaceCwd: CWD,
      spec: specWith({ name: '草稿', slug: 'del-no-purge' }),
    })
    const result = purgeApp(db, created.data.appId)
    assert.equal(result.kind, 'use_discard')
    assert.ok(getAppById(db, created.data.appId))
    db.close()
  })
})
