import './support/no-stray-processes.mjs'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../db.mjs'
import { SUPPLIER_VISITS_SPEC } from '../apps/fixtures.mjs'
import { insertRecord, listRecords } from '../apps/records.mjs'
import { activateApp, createAppDraft, trashApp } from '../apps/repository.mjs'
import { createServer } from 'node:http'
import {
  isPublicAppFace,
  lanFaceForbidden,
  liveShareForApp,
  liveShareIdsByApp,
  mintShare,
  pickLanIpv4,
  publicShareCors,
  publicShareUrl,
  resolveLiveShare,
  revokeLiveSharesForApp,
} from '../apps/share.mjs'
import { WEB_APP_CSP_SANDBOX, WEB_APP_IFRAME_SANDBOX, webAppHtmlHeaders } from '../apps/web-host.mjs'
import { handleAppShareRoutes } from '../routes/app-share.mjs'
import { handleAppsRoutes } from '../routes/apps.mjs'
import { handlePublicAppDocument } from '../routes/public-app.mjs'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const CWD = '/tmp/fde-app-share-cwd'

function uniqueSpec() {
  return {
    ...SUPPLIER_VISITS_SPEC,
    slug: `visits-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  }
}

function dbWithActive(spec = uniqueSpec()) {
  const db = openDatabase(`/tmp/fde-apps-share-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`, join(repoRoot, 'runtime/migrations'))
  const created = createAppDraft(db, {
    workspaceId: 'ws_personal',
    workspaceCwd: CWD,
    spec,
  })
  assert.equal(created.ok, true, JSON.stringify(created.errors || created))
  const activated = activateApp(db, created.data.appId, { workspaceId: 'ws_personal' })
  assert.equal(activated.kind, 'ok')
  return { db, spec, appId: created.data.appId }
}

function envelope() {
  let status = 0
  let body = null
  return {
    statusOf: () => status,
    bodyOf: () => body,
    sendJson(_response, code, payload) {
      status = code
      body = payload
    },
    sendError(_response, code, err, message, correlationId) {
      status = code
      body = { error: { code: err, message }, correlationId }
    },
  }
}

function fakeRequest({ method, url, body, remoteAddress = '127.0.0.1', origin } = {}) {
  return {
    method,
    url,
    headers: {
      host: '127.0.0.1:4318',
      ...(origin ? { origin } : {}),
    },
    socket: { remoteAddress },
    body,
  }
}

describe('app live share occupancy', () => {
  test('mint binds app+slug+cwd; public insert lands on the same ledger', async () => {
    const { db, spec, appId } = dbWithActive()
    const share = mintShare(db, { appId, slug: spec.slug, workspaceCwd: CWD })
    assert.ok(share.id)
    assert.equal(liveShareForApp(db, appId).id, share.id)
    const again = mintShare(db, { appId, slug: spec.slug, workspaceCwd: CWD })
    assert.equal(again.id, share.id)

    const env = envelope()
    const posted = await handleAppShareRoutes(
      fakeRequest({ method: 'POST', url: `/api/v1/app-share/${share.id}/${spec.entities[0].name}` }),
      {},
      new URL(`http://127.0.0.1/api/v1/app-share/${share.id}/${spec.entities[0].name}`),
      {
        db,
        correlationId: 'corr_share',
        sendJson: env.sendJson,
        sendError: env.sendError,
        readJson: async () => ({ supplier: '北郊仓', visit_date: '2026-10-14', status: '计划' }),
      },
    )
    assert.equal(posted, true)
    assert.equal(env.statusOf(), 201)
    assert.equal(env.bodyOf().data.supplier, '北郊仓')
    const listed = listRecords(db, spec, 'visit', CWD)
    assert.equal(listed.total, 1)
    assert.equal(listed.rows[0].supplier, '北郊仓')
    db.close()
  })

  test('owner list sees visitor writes; revoke then 404', async () => {
    const { db, spec, appId } = dbWithActive()
    const share = mintShare(db, { appId, slug: spec.slug, workspaceCwd: CWD })
    insertRecord(db, spec, 'visit', CWD, { supplier: '本机', visit_date: '2026-10-14', status: '计划' })
    const env = envelope()
    await handleAppShareRoutes(
      fakeRequest({ method: 'GET', url: `/api/v1/app-share/${share.id}/visit` }),
      {},
      new URL(`http://127.0.0.1/api/v1/app-share/${share.id}/visit`),
      {
        db,
        correlationId: 'corr_list',
        sendJson: env.sendJson,
        sendError: env.sendError,
        readJson: async () => ({}),
      },
    )
    assert.equal(env.statusOf(), 200)
    assert.equal(env.bodyOf().data.total, 1)
    revokeLiveSharesForApp(db, appId)
    assert.equal(resolveLiveShare(db, share.id), null)
    const after = envelope()
    await handleAppShareRoutes(
      fakeRequest({ method: 'GET', url: `/api/v1/app-share/${share.id}` }),
      {},
      new URL(`http://127.0.0.1/api/v1/app-share/${share.id}`),
      {
        db,
        correlationId: 'corr_revoked',
        sendJson: after.sendJson,
        sendError: after.sendError,
        readJson: async () => ({}),
      },
    )
    assert.equal(after.statusOf(), 404)
    db.close()
  })

  test('draft cannot mint; trash revokes live share', async () => {
    const db = openDatabase(`/tmp/fde-apps-share-draft-${Date.now()}.sqlite`, join(repoRoot, 'runtime/migrations'))
    const spec = uniqueSpec()
    const created = createAppDraft(db, { workspaceId: 'ws_personal', workspaceCwd: CWD, spec })
    const env = envelope()
    await handleAppsRoutes(
      fakeRequest({ method: 'POST', url: `/api/v1/apps/${created.data.appId}/share`, origin: 'http://127.0.0.1:5174' }),
      {},
      new URL(`http://127.0.0.1/api/v1/apps/${created.data.appId}/share`),
      {
        db,
        allowedOrigins: new Set(['http://127.0.0.1:5174']),
        correlationId: 'corr_draft',
        sendJson: env.sendJson,
        sendError: env.sendError,
        readJson: async () => ({}),
      },
    )
    assert.equal(env.statusOf(), 409)
    activateApp(db, created.data.appId, { workspaceId: 'ws_personal' })
    const minted = envelope()
    await handleAppsRoutes(
      fakeRequest({ method: 'POST', url: `/api/v1/apps/${created.data.appId}/share`, origin: 'http://127.0.0.1:5174' }),
      {},
      new URL(`http://127.0.0.1/api/v1/apps/${created.data.appId}/share`),
      {
        db,
        allowedOrigins: new Set(['http://127.0.0.1:5174']),
        correlationId: 'corr_mint',
        sendJson: minted.sendJson,
        sendError: minted.sendError,
        readJson: async () => ({}),
      },
    )
    assert.equal(minted.statusOf(), 200)
    assert.match(String(minted.bodyOf().data.url), /\/a\//)
    assert.ok((minted.bodyOf().data.urls || []).some((row) => row.kind === 'loopback' && String(row.url).includes('127.0.0.1')))
    assert.equal(liveShareIdsByApp(db).get(created.data.appId), minted.bodyOf().data.shareId)
    const shareId = minted.bodyOf().data.shareId
    trashApp(db, created.data.appId, { workspaceId: 'ws_personal' })
    assert.equal(resolveLiveShare(db, shareId), null)
    db.close()
  })

  test('public face refuses biz actions and LAN leftover paths', async () => {
    const base = uniqueSpec()
    const { db, spec, appId } = dbWithActive({
      ...base,
      actions: [
        ...(base.actions || []),
        { name: 'post', kind: 'biz', entity: 'visit', label: '过账', biz: { kind: 'visit', action: '改行' } },
      ],
    })
    const share = mintShare(db, { appId, slug: spec.slug, workspaceCwd: CWD })
    const env = envelope()
    await handleAppShareRoutes(
      fakeRequest({ method: 'POST', url: `/api/v1/app-share/${share.id}/actions/post` }),
      {},
      new URL(`http://127.0.0.1/api/v1/app-share/${share.id}/actions/post`),
      {
        db,
        correlationId: 'corr_biz',
        sendJson: env.sendJson,
        sendError: env.sendError,
        readJson: async () => ({ rids: ['x'] }),
      },
    )
    assert.equal(env.statusOf(), 403)
    assert.equal(env.bodyOf().error.code, 'owner_only')
    db.close()

    const lan = { socket: { remoteAddress: '192.168.1.20' } }
    assert.equal(lanFaceForbidden(lan, '/api/v1/apps'), true)
    assert.equal(lanFaceForbidden(lan, '/api/v1/im/mailbox'), true)
    assert.equal(lanFaceForbidden(lan, `/a/${share.id}`), false)
    assert.equal(lanFaceForbidden(lan, `/api/v1/app-share/${share.id}`), false)
    assert.equal(lanFaceForbidden({ socket: { remoteAddress: '127.0.0.1' } }, '/api/v1/apps'), false)
    assert.equal(isPublicAppFace('/assets/index.js'), true)
    assert.equal(isPublicAppFace('/ai'), false)
    assert.equal(isPublicAppFace('/src/main.tsx', { staticDir: '' }), true)
    assert.equal(isPublicAppFace('/src/main.tsx', { staticDir: '/pack/dist' }), false)
  })

  test('serveWebAppAsset puts CSP sandbox on HTML', async () => {
    const { mkdtemp, writeFile, mkdir, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { serveWebAppAsset } = await import('../apps/web-host.mjs')
    const cwd = await mkdtemp(join(tmpdir(), 'fde-web-csp-'))
    const spec = { spec: 'fde-web/v1', slug: 'csp-probe', name: 'csp', entry: 'index.html', bundleRoot: 'apps/csp-probe' }
    await mkdir(join(cwd, 'apps/csp-probe'), { recursive: true })
    await writeFile(join(cwd, 'apps/csp-probe/index.html'), '<html><head></head><body>hi</body></html>')
    const headers = {}
    const response = {
      writeHead(status, head) { this.status = status; Object.assign(headers, head) },
      end() {},
    }
    const ok = serveWebAppAsset({ method: 'GET' }, response, {
      spec,
      workspaceCwd: cwd,
      relPath: '',
      livePrefix: '/a/x',
      storePrefix: '/api/v1/app-share/x/store',
    })
    assert.equal(ok, true)
    assert.match(headers['Content-Security-Policy'], /^sandbox /)
    assert.equal(headers['Content-Security-Policy'].includes('allow-same-origin'), false)
    await rm(cwd, { recursive: true, force: true })
  })

  test('share write limiter trips after the window budget', async () => {
    const { shareWriteLimited, resetShareWriteLimits } = await import('../apps/share-write-limit.mjs')
    resetShareWriteLimits()
    let blocked = 0
    for (let i = 0; i < 61; i++) {
      if (shareWriteLimited('127.0.0.1:share-x')) blocked += 1
    }
    assert.equal(blocked, 1)
    resetShareWriteLimits()
  })

  test('shipped JSON reader rejects bodies over the public share cap', async () => {
    const { Readable } = await import('node:stream')
    const { readJsonFromRequest } = await import('../http-json.mjs')
    const { PUBLIC_SHARE_JSON_MAX } = await import('../apps/share-write-limit.mjs')
    const stream = Readable.from([Buffer.alloc(PUBLIC_SHARE_JSON_MAX + 1, 0x61)])
    await assert.rejects(
      () => readJsonFromRequest(stream, { maxBytes: PUBLIC_SHARE_JSON_MAX }),
      /request_too_large/,
    )
  })

  test('public share POST returns 413 when the shipped cap throws', async () => {
    const { PUBLIC_SHARE_JSON_MAX } = await import('../apps/share-write-limit.mjs')
    const { db, spec, appId } = dbWithActive()
    const share = mintShare(db, { appId, slug: spec.slug, workspaceCwd: CWD })
    const env = envelope()
    let seenMax = 0
    await handleAppShareRoutes(
      fakeRequest({ method: 'POST', url: `/api/v1/app-share/${share.id}/visit` }),
      {},
      new URL(`http://127.0.0.1/api/v1/app-share/${share.id}/visit`),
      {
        db,
        correlationId: 'corr_413',
        sendJson: env.sendJson,
        sendError: env.sendError,
        readJson: async (_req, opts = {}) => {
          seenMax = Number(opts.maxBytes) || 0
          if (seenMax !== PUBLIC_SHARE_JSON_MAX) throw new Error(`cap ${seenMax}`)
          throw new Error('request_too_large')
        },
      },
    )
    assert.equal(seenMax, PUBLIC_SHARE_JSON_MAX)
    assert.equal(env.statusOf(), 413)
    assert.equal(env.bodyOf().error.code, 'request_too_large')
    db.close()
  })

  test('hosted web HTML is sandboxed without same-origin', () => {
    assert.equal(WEB_APP_IFRAME_SANDBOX.includes('allow-same-origin'), false)
    assert.match(WEB_APP_CSP_SANDBOX, /^sandbox /)
    assert.equal(WEB_APP_CSP_SANDBOX.includes('allow-same-origin'), false)
    const headers = webAppHtmlHeaders()
    assert.equal(headers['Content-Security-Policy'], WEB_APP_CSP_SANDBOX)
    assert.equal(headers['X-Content-Type-Options'], 'nosniff')
  })

  test('Origin null CORS is only for the share capability mouth', () => {
    assert.equal(publicShareCors('null', '/api/v1/app-share/abc/store/k')['Access-Control-Allow-Origin'], 'null')
    assert.equal(publicShareCors('null', '/api/v1/ai/sessions'), null)
    assert.equal(publicShareCors('http://127.0.0.1:5174', '/api/v1/app-share/abc'), null)
  })

  test('LAN URL prefers 192.168 on en0 over overlay/utun', () => {
    const picked = pickLanIpv4([
      { address: '10.168.1.2', family: 'IPv4', internal: false, iface: 'utun4' },
      { address: '192.168.1.8', family: 'IPv4', internal: false, iface: 'en0' },
      { address: '127.0.0.1', family: 'IPv4', internal: true, iface: 'lo0' },
    ])
    assert.equal(picked[0], '192.168.1.8')
  })

  test('public document also proxies Vite module graph', async () => {
    const vite = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript' })
      res.end(`/* ${req.url} */`)
    })
    await new Promise((resolve) => vite.listen(0, '127.0.0.1', resolve))
    const webPort = vite.address().port
    const bff = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (handlePublicAppDocument(req, res, url, { staticDir: '', webPort })) return
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'not_found', message: '接口不存在' } }))
    })
    await new Promise((resolve) => bff.listen(0, '127.0.0.1', resolve))
    const bffPort = bff.address().port
    const client = await fetch(`http://127.0.0.1:${bffPort}/@vite/client`)
    const main = await fetch(`http://127.0.0.1:${bffPort}/src/main.tsx`)
    const probe = await fetch(`http://127.0.0.1:${bffPort}/runtime/live-probe.mjs`)
    assert.equal(client.status, 200)
    assert.equal(main.status, 200)
    assert.equal(probe.status, 200)
    assert.match(await client.text(), /@vite\/client/)
    assert.match(await probe.text(), /live-probe/)
    bff.close()
    vite.close()
  })

  test('GET /a/:shareId is the public document, not API 404', async () => {
    const vite = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><html data-public-app="true"></html>')
    })
    await new Promise((resolve) => vite.listen(0, '127.0.0.1', resolve))
    const webPort = vite.address().port
    const bff = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (handlePublicAppDocument(req, res, url, { staticDir: '', webPort })) return
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'not_found', message: '接口不存在' } }))
    })
    await new Promise((resolve) => bff.listen(0, '127.0.0.1', resolve))
    const bffPort = bff.address().port
    const res = await fetch(`http://127.0.0.1:${bffPort}/a/tok_public`)
    const text = await res.text()
    assert.equal(res.status, 200)
    assert.match(text, /data-public-app/)
    bff.close()
    vite.close()
  })

  test('public URL is LAN path /a/:shareId', () => {
    const url = publicShareUrl('tok_abc', { port: 4318, host: '192.168.1.8' })
    assert.equal(url, 'http://192.168.1.8:4318/a/tok_abc')
  })

  test('public route sits outside IMScreen', async () => {
    const src = await readFile(join(repoRoot, 'src/App.tsx'), 'utf8')
    assert.match(src, /path="\/a\/:shareId"/)
    assert.match(src, /PublicApp/)
    const publicIdx = src.indexOf('/a/:shareId')
    const shellIdx = src.indexOf('<IMScreen')
    assert.ok(publicIdx > 0 && shellIdx > publicIdx)
  })
})
