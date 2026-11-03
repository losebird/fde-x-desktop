import './support/no-stray-processes.mjs'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { adoptIuiPage, slugFromTitle } from '../apps/adopt-iui.mjs'
import { getAppById } from '../apps/repository.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')

function db() {
  return openDatabase(`/tmp/fde-adopt-iui-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`, join(repoRoot, 'runtime/migrations'))
}

describe('adopt IUI page as fde-web', () => {
  test('slugFromTitle keeps ascii and falls back for 中文', () => {
    assert.equal(slugFromTitle('Floor Plan'), 'floor-plan')
    assert.match(slugFromTitle('工位图'), /^iui-[a-z0-9]+$/)
  })

  test('adoptIuiPage writes index.html and activates', () => {
    const cwd = `/tmp/fde-adopt-iui-ws-${Date.now()}`
    mkdirSync(cwd, { recursive: true })
    const sqlite = db()
    const html = '<!doctype html><html><body><div id="desk">格子</div></body></html>'
    const got = adoptIuiPage({
      db: sqlite,
      workspaceId: 'ws_personal',
      workspaceCwd: cwd,
      title: 'Desk Grid',
      html,
    })
    assert.equal(got.ok, true, JSON.stringify(got))
    assert.equal(got.slug, 'desk-grid')
    const app = getAppById(sqlite, got.appId, 'ws_personal')
    assert.equal(app.status, 'active')
    assert.equal(app.spec.spec, 'fde-web/v1')
    const disk = readFileSync(join(cwd, 'apps', 'desk-grid', 'index.html'), 'utf8')
    assert.match(disk, /id="desk"/)
    sqlite.close()
    rmSync(cwd, { recursive: true, force: true })
  })
})
