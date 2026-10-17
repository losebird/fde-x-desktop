import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gzip } from 'pako'
export { assertIuiTree, stageIuiArtifact, stageIuiArtifactIfAbsent } from '../../runtime/iui-stage.mjs'

export function iuiArtifactName(commit) {
  return `iui-${commit}.tar.gz`
}

export function defaultIuiArtifactPath(repoRoot, commit) {
  return join(repoRoot, 'scripts', 'pack', '.cache', iuiArtifactName(commit))
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

const TAR_BLOCK = 512
const TAR_RECORD = 20 * TAR_BLOCK

function putOctal(buf, offset, value, width) {
  const text = value.toString(8).padStart(width - 1, '0')
  if (text.length !== width - 1) throw new Error(`octal overflow ${value} width ${width}`)
  buf.write(text, offset, width - 1, 'ascii')
  buf[offset + width - 1] = 0
}

function tarHeader({ name, mode, size, type, link = '' }) {
  const buf = Buffer.alloc(TAR_BLOCK)
  const nameBytes = Buffer.from(name)
  if (nameBytes.length > 100) nameBytes.copy(buf, 0, 0, 100)
  else nameBytes.copy(buf, 0)
  putOctal(buf, 100, mode & 0o777, 8)
  putOctal(buf, 108, 0, 8)
  putOctal(buf, 116, 0, 8)
  putOctal(buf, 124, size, 12)
  putOctal(buf, 136, 0, 12)
  buf.fill(0x20, 148, 156)
  buf[156] = type.charCodeAt(0)
  const linkBytes = Buffer.from(link)
  if (linkBytes.length > 100) linkBytes.copy(buf, 157, 0, 100)
  else linkBytes.copy(buf, 157)
  buf.write('ustar ', 257, 6, 'ascii')
  buf[263] = 0x20
  buf[264] = 0
  let sum = 0
  for (let i = 0; i < TAR_BLOCK; i += 1) sum += buf[i]
  const digits = sum.toString(8).padStart(6, '0')
  if (digits.length !== 6) throw new Error(`checksum overflow ${sum}`)
  buf.write(digits, 148, 6, 'ascii')
  buf[154] = 0
  buf[155] = 0x20
  return buf
}

function pushPadded(parts, payload) {
  parts.push(payload)
  const pad = (TAR_BLOCK - (payload.length % TAR_BLOCK)) % TAR_BLOCK
  if (pad) parts.push(Buffer.alloc(pad))
}

function writeGnuLong(parts, type, text) {
  const payload = Buffer.concat([Buffer.from(text), Buffer.from([0])])
  parts.push(tarHeader({ name: '././@LongLink', mode: 0o644, size: payload.length, type }))
  pushPadded(parts, payload)
}

function writeTarEntry(parts, name, mode, body, link = null) {
  const bytes = body == null ? null : Buffer.from(body)
  if (Buffer.from(name).length > 100) writeGnuLong(parts, 'L', name)
  if (link != null && Buffer.from(link).length > 100) writeGnuLong(parts, 'K', link)
  parts.push(tarHeader({
    name,
    mode,
    size: bytes ? bytes.length : 0,
    type: link != null ? '2' : bytes == null ? '5' : '0',
    link: link || '',
  }))
  if (bytes && bytes.length) pushPadded(parts, bytes)
}

const NPM_LOCK = './node_modules/.package-lock.json'

export function configuredRegistryList() {
  const raw = execFileSync('npm', ['config', 'list', '--json'], {
    encoding: 'utf8',
    env: process.env,
  })
  const cfg = JSON.parse(raw)
  const list = []
  if (typeof cfg.registry === 'string') list.push(cfg.registry)
  for (const [key, value] of Object.entries(cfg)) {
    if (key.startsWith('@') && key.endsWith(':registry') && typeof value === 'string') list.push(value)
  }
  return list
}

function registryPrefix(registry) {
  return String(registry || '').trim().replace(/\/+$/, '')
}

export function canonicalNpmLockBytes(body, registries = configuredRegistryList()) {
  const prefixes = []
  for (const registry of registries) {
    const prefix = registryPrefix(registry)
    if (prefix && !prefixes.includes(prefix)) prefixes.push(prefix)
  }
  prefixes.sort((left, right) => right.length - left.length)
  const text = Buffer.from(body).toString('utf8')
  const next = text.replace(/"resolved": "([^"]*)"/g, (full, url) => {
    for (const prefix of prefixes) {
      const needle = `${prefix}/`
      if (!url.startsWith(needle)) continue
      return `"resolved": "https://registry.npmjs.org/${url.slice(needle.length)}"`
    }
    return full
  })
  return Buffer.from(next)
}

function fileBodyForPack(archiveName, diskPath) {
  const body = readFileSync(diskPath)
  if (archiveName === NPM_LOCK) return canonicalNpmLockBytes(body)
  return body
}

function writeTarDirectory(parts, diskPath, archiveName) {
  const stat = lstatSync(diskPath)
  if (!stat.isDirectory()) throw new Error(`IUI pack expected a directory: ${diskPath}`)
  const dirName = archiveName.endsWith('/') ? archiveName : `${archiveName}/`
  writeTarEntry(parts, dirName, stat.mode, null)
  const kids = readdirSync(diskPath).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
  for (const kid of kids) {
    const childDisk = join(diskPath, kid)
    const child = lstatSync(childDisk)
    const childName = `${dirName}${kid}`
    if (child.isDirectory()) writeTarDirectory(parts, childDisk, childName)
    else if (child.isSymbolicLink()) writeTarEntry(parts, childName, child.mode, null, readlinkSync(childDisk))
    else if (child.isFile()) writeTarEntry(parts, childName, child.mode, fileBodyForPack(childName, childDisk))
    else throw new Error(`unsupported file type ${childDisk}`)
  }
}

function packGnuTar(tree) {
  const parts = []
  writeTarDirectory(parts, tree, '.')
  parts.push(Buffer.alloc(TAR_BLOCK * 2))
  let size = 0
  for (const part of parts) size += part.length
  const rem = size % TAR_RECORD
  if (rem) parts.push(Buffer.alloc(TAR_RECORD - rem))
  return Buffer.concat(parts)
}

export async function packDeterministicTarGz(tree, artifactPath) {
  await mkdir(dirname(artifactPath), { recursive: true })
  const tarBytes = packGnuTar(tree)
  const gz = gzip(tarBytes, { level: 6, mtime: 0 })
  await writeFile(artifactPath, gz)
}

function packedRel(archiveName) {
  return archiveName.replace(/^\.\//, '')
}

export function collectPackedFileShas(tree) {
  const out = {}
  function walk(diskPath, archiveName) {
    const stat = lstatSync(diskPath)
    if (stat.isDirectory()) {
      const dirName = archiveName.endsWith('/') ? archiveName : `${archiveName}/`
      for (const kid of readdirSync(diskPath)) {
        walk(join(diskPath, kid), `${dirName}${kid}`)
      }
      return
    }
    if (!stat.isFile()) return
    out[packedRel(archiveName)] = sha256Hex(fileBodyForPack(archiveName, diskPath))
  }
  walk(tree, '.')
  return out
}

export function explainPinDrift(tree, manifestFiles) {
  const actual = collectPackedFileShas(tree)
  const lines = []
  const keys = new Set([...Object.keys(actual), ...Object.keys(manifestFiles)])
  for (const key of [...keys].sort()) {
    if (!(key in manifestFiles)) lines.push(`only in build ${key} ${actual[key]}`)
    else if (!(key in actual)) lines.push(`missing ${key}`)
    else if (actual[key] !== manifestFiles[key]) {
      lines.push(`differs ${key}\n  expected ${manifestFiles[key]}\n  actual   ${actual[key]}`)
    }
  }
  if (!lines.length) lines.push('packed file bytes match the pin manifest; tar metadata differs')
  return lines.join('\n')
}

export function bundledPluginVersions(plugins, pluginsRoot) {
  const versions = {}
  for (const plugin of plugins) {
    const present = existsSync(join(pluginsRoot, plugin.dir, 'package.json'))
    if (plugin.source.kind === 'pinned') {
      versions[plugin.dir] = {
        staged: present,
        version: plugin.source.version,
        commit: plugin.source.commit,
      }
    } else {
      versions[plugin.dir] = present
    }
  }
  return versions
}

export function retargetPrimitivePaths(tsconfigText, typesDir) {
  const index = JSON.stringify(join(typesDir, 'index.d.ts'))
  const star = JSON.stringify(join(typesDir, '*'))
  let next = String(tsconfigText)
  const block = /"@deepseek-ai\/dsh-client-ui-primitives":\s*\[[\s\S]*?\]/u
  const starBlock = /"@deepseek-ai\/dsh-client-ui-primitives\/\*":\s*\[[\s\S]*?\]/u
  if (!block.test(next) || !starBlock.test(next)) {
    throw new Error('IUI tsconfig is missing @deepseek-ai/dsh-client-ui-primitives paths')
  }
  next = next.replace(block, `"@deepseek-ai/dsh-client-ui-primitives": [\n        ${index}\n      ]`)
  next = next.replace(starBlock, `"@deepseek-ai/dsh-client-ui-primitives/*": [\n        ${star}\n      ]`)
  if (next.includes('/opt/homebrew/') || next.includes('/home/box/')) {
    throw new Error('IUI tsconfig still points at a machine path')
  }
  return next
}
