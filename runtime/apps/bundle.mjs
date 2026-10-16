import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

export function isWebAppSpec(spec) {
  return Boolean(spec && typeof spec === 'object' && spec.spec === 'fde-web/v1')
}

export function bundleRelRoot(spec) {
  const slug = String(spec?.slug || 'app')
  const raw = String(spec?.bundleRoot || `apps/${slug}`).replace(/\\/g, '/').replace(/^\/+/, '')
  return raw || `apps/${slug}`
}

export function bundleEntryName(spec) {
  const raw = String(spec?.entry || 'index.html').replace(/\\/g, '/').replace(/^\/+/, '')
  return raw || 'index.html'
}

function assertRel(rel, pathLabel) {
  const value = String(rel || '').replace(/\\/g, '/')
  if (!value || value.startsWith('/') || value.includes('..') || value.includes('\0')) {
    const err = new Error(`${pathLabel} 超出包根`)
    err.code = 'bundle_path'
    throw err
  }
  return value
}

export function resolveBundleRoot(workspaceCwd, spec) {
  const cwd = resolve(String(workspaceCwd || ''))
  const rel = assertRel(bundleRelRoot(spec), 'bundleRoot')
  const root = resolve(cwd, rel)
  if (root !== cwd && !root.startsWith(cwd + sep)) {
    const err = new Error('bundleRoot 超出工作区')
    err.code = 'bundle_path'
    throw err
  }
  return root
}

export function resolveBundleFile(root, relPath) {
  const rel = assertRel(String(relPath || '').replace(/^\/+/, '') || bundleEntryName({}), 'path')
  const full = resolve(root, rel)
  if (full !== root && !full.startsWith(root + sep)) return null
  return full
}

export function mimeFor(filePath) {
  return MIME[extname(filePath).toLowerCase()] || 'application/octet-stream'
}

export function bundleEntryExists(workspaceCwd, spec) {
  try {
    const root = resolveBundleRoot(workspaceCwd, spec)
    const file = resolveBundleFile(root, bundleEntryName(spec))
    return Boolean(file && existsSync(file) && statSync(file).isFile())
  } catch {
    return false
  }
}

export function readBundleBytes(workspaceCwd, spec, relPath) {
  const root = resolveBundleRoot(workspaceCwd, spec)
  const file = resolveBundleFile(root, relPath || bundleEntryName(spec))
  if (!file || !existsSync(file) || !statSync(file).isFile()) return null
  return { bytes: readFileSync(file), mime: mimeFor(file), file }
}

export function writeBundleFiles(workspaceCwd, spec, files) {
  const root = resolveBundleRoot(workspaceCwd, spec)
  mkdirSync(root, { recursive: true })
  const written = []
  for (const row of Array.isArray(files) ? files : []) {
    const rel = assertRel(String(row?.path || '').replace(/^\/+/, ''), 'files.path')
    const file = resolveBundleFile(root, rel)
    if (!file) continue
    mkdirSync(dirname(file), { recursive: true })
    const content = row.content
    if (typeof content === 'string') writeFileSync(file, content, 'utf8')
    else if (content && typeof content.base64 === 'string') writeFileSync(file, Buffer.from(content.base64, 'base64'))
    else continue
    written.push(rel)
  }
  return { root, written }
}


