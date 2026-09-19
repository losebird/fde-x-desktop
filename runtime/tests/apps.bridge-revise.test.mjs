import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listBusinessApps, openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { activateApp } from '../apps/repository.mjs'
import { getAppById } from '../apps/repository.mjs'
import { handleAppsBridge } from '../routes/apps.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/fde-app-bridge-revise-cwd'

function uniqueSpec() {
  return {
    ...SUPPLIER_VISITS_SPEC,
    slug: `visits-rev-${Date.now().toString(36)}`,
  }
}

describe('bridge app-spec-submit revise', () => {
  test('submit without appId still creates a draft', () => {
    const db = openDatabase(`/tmp/fde-bridge-rev-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const before = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD }).length
    const result = handleAppsBridge('app-spec-submit', { spec }, db, CWD)
    assert.equal(result.ok, true)
    assert.ok(result.appId)
    assert.equal(result.revision, 1)
    const after = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD })
    assert.equal(after.length, before + 1)
    db.close()
  })

  test('create+activate then submit with appId → revision 2, same appId', () => {
    const db = openDatabase(`/tmp/fde-bridge-rev2-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const created = handleAppsBridge('app-spec-submit', { spec }, db, CWD)
    assert.equal(created.ok, true)
    const appId = created.appId
    const activated = activateApp(db, appId)
    assert.equal(activated.kind, 'ok')
    const countBefore = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD }).length
    const nextSpec = {
      ...spec,
      name: `${spec.name}（改）`,
    }
    const revised = handleAppsBridge('app-spec-submit', { spec: nextSpec, appId }, db, CWD)
    assert.equal(revised.ok, true)
    assert.equal(revised.appId, appId)
    assert.equal(revised.revision, 2)
    const countAfter = listBusinessApps(db, { workspaceId: 'ws_personal', workspaceCwd: CWD }).length
    assert.equal(countAfter, countBefore)
    const app = getAppById(db, appId)
    assert.equal(app.currentRevision, 2)
    assert.equal(app.spec.name, nextSpec.name)
    db.close()
  })

  test('submit with unknown appId → ok false', () => {
    const db = openDatabase(`/tmp/fde-bridge-rev3-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const result = handleAppsBridge('app-spec-submit', { spec, appId: 'app_nonexistent' }, db, CWD)
    assert.equal(result.ok, false)
    assert.ok(result.errors?.some((e) => e.path === 'appId'))
    db.close()
  })
})
