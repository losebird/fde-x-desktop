import './support/no-stray-processes.mjs'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { openDatabase } from '../db.mjs'
import { activateApp, createAppDraft } from '../apps/repository.mjs'
import { validateAppSpec } from '../apps/spec.mjs'
import { writeBundleFiles } from '../apps/bundle.mjs'
import { getDocument, putDocument } from '../apps/documents.mjs'
import { handleAppsRoutes, handleAppsBridge } from '../routes/apps.mjs'
import { handlePublicWebBundle } from '../routes/app-share.mjs'
import { mintShare } from '../apps/share.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = `/tmp/fde-web-app-${Date.now()}`

function db() {
  return openDatabase(`/tmp/fde-apps-web-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`, join(repoRoot, 'runtime/migrations'))
}

function webSpec(slug = `web-${Date.now().toString(36)}`) {
  return {
    spec: 'fde-web/v1',
    slug,
    name: '户型工作台',
    bundleRoot: `apps/${slug}`,
    entry: 'index.html',
  }
}

describe('hosted web app occupancy', () => {
  test('web spec validates; ledger extra keys still fail', () => {
    const ok = validateAppSpec(webSpec('floor-plan'))
    assert.equal(ok.ok, true)
    const bad = validateAppSpec({ spec: 'fde-app/v1', slug: 'x', name: 'x' })
    assert.equal(bad.ok, false)
  })

  test('builder files persist; activate; live html injects bridge; store roundtrip', async () => {
    mkdirSync(CWD, { recursive: true })
    const sqlite = db()
    const spec = webSpec()
    const created = createAppDraft(sqlite, { workspaceId: 'ws_personal', workspaceCwd: CWD, spec })
    assert.equal(created.ok, true, JSON.stringify(created.errors || created))
    writeBundleFiles(CWD, spec, [{
      path: 'index.html',
      content: '<!doctype html><html><head><title>plan</title></head><body><div id="plan">ok</div></body></html>',
    }])
    const activated = activateApp(sqlite, created.data.appId, { workspaceId: 'ws_personal' })
    assert.equal(activated.kind, 'ok', JSON.stringify(activated))

    putDocument(sqlite, {
      workspaceId: 'ws_personal',
      appId: created.data.appId,
      slug: spec.slug,
      workspaceCwd: CWD,
      key: 'localStorage',
      value: { wall: '1200' },
    })
    assert.equal(getDocument(sqlite, { appId: created.data.appId, workspaceCwd: CWD, key: 'localStorage', workspaceId: 'ws_personal' }).wall, '1200')

    const env = { status: 0, body: null, headers: {} }
    const response = {
      headersSent: false,
      writableEnded: false,
      writeHead(code, headers) { env.status = code; env.headers = headers || {} },
      end(buf) { env.body = buf ? String(buf) : '' },
    }
    const handled = await handleAppsRoutes(
      { method: 'GET', url: `/api/v1/apps/${created.data.appId}/live/`, headers: { host: '127.0.0.1:4318' }, socket: { remoteAddress: '127.0.0.1' } },
      response,
      new URL(`http://127.0.0.1/api/v1/apps/${created.data.appId}/live/`),
      {
        db: sqlite,
        allowedOrigins: new Set(['http://127.0.0.1:5174']),
        correlationId: 'corr_live',
        sendJson(res, code, payload) { env.status = code; env.body = JSON.stringify(payload) },
        sendError(res, code, err, message) { env.status = code; env.body = JSON.stringify({ error: { code: err, message } }) },
        readJson: async () => ({}),
      },
    )
    assert.equal(handled, true)
    assert.equal(env.status, 200)
    assert.match(String(env.body), /id="plan"/)
    assert.match(String(env.body), /__fde\/bridge\.js/)
    assert.match(String(env.body), /1200/)
    sqlite.close()
    rmSync(CWD, { recursive: true, force: true })
  })

  test('bridge submit writes files; public /a serves the bundle not FDE spa', async () => {
    const cwd = `/tmp/fde-web-pub-${Date.now()}`
    mkdirSync(cwd, { recursive: true })
    const sqlite = db()
    sqlite.prepare(`UPDATE workspaces SET metadata_json = ? WHERE id = 'ws_personal'`).run(JSON.stringify({ cwd }))
    const spec = webSpec(`pub-${Date.now().toString(36)}`)
    const submitted = await handleAppsBridge('app-spec-submit', {
      spec,
      files: [{ path: 'index.html', content: '<html><body>WEBAPP</body></html>' }],
    }, sqlite, cwd)
    assert.equal(submitted.ok, true, JSON.stringify(submitted))
    const activated = activateApp(sqlite, submitted.appId, { workspaceId: 'ws_personal' })
    assert.equal(activated.kind, 'ok', JSON.stringify(activated))
    const share = mintShare(sqlite, { appId: submitted.appId, slug: spec.slug, workspaceCwd: cwd })
    const vite = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html data-fde-spa="true"></html>')
    })
    await new Promise((resolve) => vite.listen(0, '127.0.0.1', resolve))
    const bff = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (handlePublicWebBundle(req, res, url, { db: sqlite })) return
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html data-fde-spa="true"></html>')
    })
    await new Promise((resolve) => bff.listen(0, '127.0.0.1', resolve))
    const port = bff.address().port
    const page = await fetch(`http://127.0.0.1:${port}/a/${share.id}/`)
    const text = await page.text()
    assert.equal(page.status, 200)
    assert.match(text, /WEBAPP/)
    assert.doesNotMatch(text, /data-fde-spa/)
    bff.close()
    vite.close()
    sqlite.close()
    rmSync(cwd, { recursive: true, force: true })
  })

  test('web spec cannot fold into ledger views requirement', () => {
    const result = validateAppSpec({
      spec: 'fde-web/v1',
      slug: 'canvas-app',
      name: '画布',
      views: [{ type: 'kanban', entity: 'room' }],
    })
    assert.equal(result.ok, true)
  })
})
