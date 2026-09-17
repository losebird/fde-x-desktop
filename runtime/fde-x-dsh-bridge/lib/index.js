const { mkdir, readdir, readFile, writeFile } = require('node:fs/promises')
const { homedir } = require('node:os')
const { join } = require('node:path')

const SKIP_SESSION_FILES = new Set(['session.lock'])
const PREFIX = '/fde-session'

function sessionRoot() {
  return process.env.FDE_DSH_SESSION_ROOT || join(process.env.DSH_HOME || join(homedir(), '.dsh-fde-x'), 'sessions')
}

function safeName(name) {
  const s = String(name || '').trim()
  if (!s || s.includes('..') || s.includes('/') || s.includes('\\') || s.includes('\0')) return ''
  if (SKIP_SESSION_FILES.has(s) || s.startsWith('.')) return ''
  return s
}

function json(res, code, body) {
  const raw = Buffer.from(JSON.stringify(body))
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': raw.length })
  res.end(raw)
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

async function findSessionDir(sessionId) {
  const id = String(sessionId || '').trim()
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('\0')) return ''
  const walk = async (dir, depth) => {
    if (depth > 3) return ''
    let entries = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return ''
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === id) return join(dir, entry.name)
      const nested = await walk(join(dir, entry.name), depth + 1)
      if (nested) return nested
    }
    return ''
  }
  return walk(sessionRoot(), 0)
}

async function readBundle(sessionId) {
  const dir = await findSessionDir(sessionId)
  if (!dir) throw new Error('找不到这个会话文件')
  const names = await readdir(dir)
  const files = []
  for (const name of names) {
    const safe = safeName(name)
    if (!safe) continue
    const buf = await readFile(join(dir, safe))
    files.push({ name: safe, size: buf.length, data: buf.toString('base64') })
  }
  if (!files.length) throw new Error('这个会话还没有可交接的文件')
  return { sessionId, files }
}

async function writeBundle(dir, files) {
  await mkdir(dir, { recursive: true })
  for (const file of Array.isArray(files) ? files : []) {
    const name = safeName(file && file.name)
    if (!name) continue
    const buf = Buffer.from(String((file && file.data) || ''), 'base64')
    if (!buf.length) continue
    await writeFile(join(dir, name), buf)
  }
}

async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const path = url.pathname.slice(PREFIX.length) || '/'
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  try {
    if (req.method === 'GET' && path === '/export') {
      const sessionId = url.searchParams.get('sessionId') || ''
      const bundle = await readBundle(sessionId)
      json(res, 200, { ok: true, ...bundle })
      return
    }
    if (req.method === 'POST' && path === '/restore') {
      const body = await readBody(req, 32 * 1024 * 1024)
      const rows = Array.isArray(body.sessions) ? body.sessions : []
      if (!rows.length) {
        json(res, 400, { ok: false, error: '交接包里没有可复原的会话文件' })
        return
      }
      json(res, 400, { ok: false, error: '请用工作台复原接口；导出已可用' })
      return
    }
    json(res, 404, { ok: false, error: 'not_found' })
  } catch (error) {
    json(res, 400, { ok: false, error: error instanceof Error ? error.message : '失败' })
  }
}

function apply(ctx) {
  if (ctx.webServer && typeof ctx.webServer.register === 'function') {
    ctx.effect(() => ctx.webServer.register({
      kind: 'prefix',
      path: PREFIX,
      handler,
    }))
  }
  void (async () => {
    try {
      const { defineTool } = await import('@deepseek-ai/dsh-tools')
      const { registerTools } = require('./tools.js')
      registerTools(ctx, { defineTool })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (ctx.logger && typeof ctx.logger.warn === 'function') {
        ctx.logger.warn(`[fde-x-dsh-bridge] tools: ${message}`)
      } else {
        console.warn(`[fde-x-dsh-bridge] tools: ${message}`)
      }
    }
  })()
}

module.exports = { apply, inject: ['webServer', 'tools'] }
exports.apply = apply
exports.inject = ['webServer', 'tools']
