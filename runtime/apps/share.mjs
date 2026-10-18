import { randomBytes } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { pathHasPrefix } from '../path-prefix.mjs'

function appIsTrashed(app) {
  return Boolean(app && String(app.deletedAt || '').trim())
}

const LIVE_SHARE = `(revoked_at IS NULL OR revoked_at = '')`

function isoNow() {
  return new Date().toISOString()
}

export function newShareId() {
  return randomBytes(18).toString('base64url')
}

export function remoteIsLoopback(request) {
  const addr = String(request?.socket?.remoteAddress || '')
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

export function isViteDevAsset(pathname) {
  const path = String(pathname || '')
  return path.startsWith('/src/')
    || path.startsWith('/@')
    || path.startsWith('/node_modules/')
    || path.startsWith('/.vite/')
    || path.startsWith('/runtime/')
}

export function isPublicAppFace(pathname, { staticDir } = {}) {
  const path = String(pathname || '')
  if (path === '/a' || path.startsWith('/a/')) return true
  if (pathHasPrefix(path, '/api/v1/app-share/')) return true
  if (path.startsWith('/assets/')) return true
  if (path.startsWith('/brand/')) return true
  if (path === '/favicon.ico' || path === '/index.html') return true
  if (!staticDir && isViteDevAsset(path)) return true
  return false
}

export function lanFaceForbidden(request, pathname, { staticDir } = {}) {
  if (remoteIsLoopback(request)) return false
  return !isPublicAppFace(pathname, { staticDir })
}

const SKIP_IFACE = /^(utun|awdl|llw|bridge|vmnet|vboxnet|vnic|docker|br-|cni|flannel|tailscale|zt)/i

export function lanIpv4Rank(address, iface) {
  if (SKIP_IFACE.test(String(iface || ''))) return 80
  const parts = String(address || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return 90
  if (parts[0] === 192 && parts[1] === 168) return 1
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return 2
  if (parts[0] === 10) return 3
  return 50
}

export function pickLanIpv4(entries) {
  const ranked = []
  for (const row of entries || []) {
    if (row.internal) continue
    const v4 = row.family === 'IPv4' || row.family === 4
    if (!v4 || !row.address) continue
    ranked.push({
      address: row.address,
      rank: lanIpv4Rank(row.address, row.iface),
      iface: String(row.iface || ''),
    })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.iface.localeCompare(b.iface))
  return ranked.map((row) => row.address)
}

export function lanIpv4Addresses() {
  const entries = []
  for (const [iface, rows] of Object.entries(networkInterfaces())) {
    for (const row of rows || []) {
      entries.push({ ...row, iface })
    }
  }
  return pickLanIpv4(entries)
}

export function requestListenPort(request, fallback) {
  const host = String(request?.headers?.host || '')
  const idx = host.lastIndexOf(':')
  if (idx > 0) {
    const n = Number(host.slice(idx + 1))
    if (Number.isInteger(n) && n > 0) return n
  }
  const fb = Number(fallback)
  return Number.isInteger(fb) && fb > 0 ? fb : 80
}

export function publicShareUrl(shareId, { port, host } = {}) {
  const ip = String(host || lanIpv4Addresses()[0] || '127.0.0.1')
  const n = Number(port)
  const portPart = Number.isInteger(n) && n > 0 && n !== 80 ? `:${n}` : ''
  return `http://${ip}${portPart}/a/${encodeURIComponent(shareId)}`
}

function mapShare(row) {
  if (!row) return null
  return {
    id: row.id,
    appId: row.app_id,
    slug: row.slug,
    workspaceCwd: row.workspace_cwd,
    createdAt: row.created_at,
    revokedAt: String(row.revoked_at || '').trim(),
  }
}

export function liveShareIdsByApp(db) {
  const rows = db.prepare(`
    SELECT app_id, id FROM app_shares WHERE ${LIVE_SHARE}
  `).all()
  const map = new Map()
  for (const row of rows) map.set(row.app_id, row.id)
  return map
}

export function liveShareForApp(db, appId) {
  const row = db.prepare(`
    SELECT id, app_id, slug, workspace_cwd, created_at, revoked_at
    FROM app_shares
    WHERE app_id = ? AND ${LIVE_SHARE}
    LIMIT 1
  `).get(appId)
  return mapShare(row)
}

export function mintShare(db, { appId, slug, workspaceCwd }) {
  const existing = liveShareForApp(db, appId)
  if (existing) return existing
  const id = newShareId()
  const now = isoNow()
  try {
    db.prepare(`
      INSERT INTO app_shares (id, app_id, slug, workspace_cwd, created_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, '')
    `).run(id, appId, slug, workspaceCwd, now)
  } catch (error) {
    const raced = liveShareForApp(db, appId)
    if (raced) return raced
    throw error
  }
  return liveShareForApp(db, appId)
}

export function revokeLiveSharesForApp(db, appId) {
  const now = isoNow()
  const result = db.prepare(`
    UPDATE app_shares SET revoked_at = ? WHERE app_id = ? AND ${LIVE_SHARE}
  `).run(now, appId)
  return { revoked: Number(result.changes || 0), revokedAt: now }
}

export function resolveLiveShare(db, shareId) {
  const id = String(shareId || '').trim()
  if (!id) return null
  const row = db.prepare(`
    SELECT
      s.id, s.app_id, s.slug, s.workspace_cwd, s.created_at, s.revoked_at,
      a.workspace_id, a.name, a.app_kind, a.status, a.current_revision,
      a.definition_json, a.created_at AS app_created_at, a.updated_at, a.deleted_at
    FROM app_shares s
    JOIN business_apps a ON a.id = s.app_id
    WHERE s.id = ? AND ${LIVE_SHARE}
  `).get(id)
  if (!row) return null
  const app = {
    id: row.app_id,
    workspaceId: row.workspace_id,
    name: row.name,
    appKind: row.app_kind,
    status: row.status,
    currentRevision: row.current_revision,
    spec: JSON.parse(row.definition_json),
    revisions: [],
    createdAt: row.app_created_at,
    updatedAt: row.updated_at,
    deletedAt: String(row.deleted_at || '').trim(),
    slug: row.slug,
  }
  if (app.status !== 'active' || appIsTrashed(app)) return null
  return {
    share: mapShare(row),
    app,
    workspaceCwd: row.workspace_cwd,
  }
}
