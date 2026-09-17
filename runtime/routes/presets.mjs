import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { FDE_APP_ROOT } from '../config.mjs'
import { createId } from '../db.mjs'

const execFileAsync = promisify(execFile)

export const PRESET_ID_RE = /^[a-z0-9][a-z0-9-_]{0,40}$/u
const FDE_PRESET_IDS = new Set(['fde-app-builder', 'fde-briefing'])
const FDE_SHIPPED_PRESET_IDS = ['fde-app-builder', 'fde-briefing']

export async function ensurePresets(dshHome) {
  const sync = process.env.FDE_PRESET_SYNC === 'force'
  const userRoot = join(dshHome, '.agent-presets')
  await mkdir(userRoot, { recursive: true })
  const shippedRoot = join(FDE_APP_ROOT, 'runtime', 'presets')
  for (const id of FDE_SHIPPED_PRESET_IDS) {
    const src = join(shippedRoot, id)
    const dest = join(userRoot, id)
    if (!existsSync(src)) continue
    if (existsSync(dest) && !sync) continue
    await cp(src, dest, { recursive: true, force: sync })
  }
}

export function parsePresetMeta(text) {
  const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || ''
  const description = text.match(/^description:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') || ''
  return { name, description }
}

async function listFilesRecursive(dir, base = dir) {
  const out = []
  let entries = []
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...await listFilesRecursive(full, base))
    } else {
      out.push(relative(base, full))
    }
  }
  return out.sort()
}

export async function detectHasLocalCode(dir, ymlTexts = []) {
  const files = await listFilesRecursive(dir)
  if (files.some((name) => /\.(mjs|js)$/iu.test(name))) return true
  for (const text of ymlTexts) {
    if (text.includes('!!js')) return true
  }
  return false
}

function readAgentPresetRoots(settingsText, dshHome, profileName) {
  const roots = []
  const userRoot = join(dshHome, '.agent-presets')
  roots.push({ kind: 'user', root: userRoot })

  const repoPresets = join(FDE_APP_ROOT, 'runtime', 'presets')
  if (existsSync(repoPresets)) roots.push({ kind: 'fde', root: repoPresets })

  const shipped = join(dshHome, 'profiles', profileName, 'node_modules', '@deepseek-ai', 'dsh-agent-presets', 'presets')
  if (existsSync(shipped)) roots.push({ kind: 'shipped', root: shipped })

  const rootsBlock = settingsText.match(/agent-presets:[\s\S]*?roots:\s*\n((?:\s+-\s+.+\n?)+)/m)?.[1] || ''
  for (const match of rootsBlock.matchAll(/^\s*-\s*(.+)$/gm)) {
    const value = match[1].trim().replace(/^['"]|['"]$/g, '')
    if (value.startsWith('/')) roots.push({ kind: 'root', root: value })
  }

  return roots
}

export async function buildPresetPathIndex(aiRuntime) {
  const index = new Map()
  let settingsText = ''
  try {
    settingsText = await readFile(join(aiRuntime.dshHome, 'settings.yaml'), 'utf8')
  } catch {
    settingsText = ''
  }
  const roots = readAgentPresetRoots(settingsText, aiRuntime.dshHome, aiRuntime.profileName)
  for (const { kind, root } of roots) {
    let entries = []
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const id = entry.name
      if (!PRESET_ID_RE.test(id)) continue
      const dir = join(root, id)
      const cordis = join(dir, 'agent.cordis.yml')
      if (!existsSync(cordis)) continue
      if (!index.has(id)) index.set(id, { path: dir, kind })
      else if (kind === 'user') index.set(id, { path: dir, kind })
    }
  }
  return index
}

export function classifyPresetSource(id, indexEntry, trust) {
  if (FDE_PRESET_IDS.has(id)) return 'fde'
  if (indexEntry?.kind === 'user') return 'user'
  if (indexEntry?.kind === 'root') return 'root'
  if (indexEntry?.kind === 'fde') return 'fde'
  if (indexEntry?.kind === 'shipped') return 'shipped'
  if (trust === 'system') return 'shipped'
  return 'user'
}

export async function enrichPresetList(aiRuntime, roster) {
  const index = await buildPresetPathIndex(aiRuntime)
  const presets = (roster?.presets || []).map((preset) => {
    const entry = index.get(preset.id)
    const source = classifyPresetSource(preset.id, entry, preset.trust)
    return {
      ...preset,
      source,
      path: entry?.path || '',
      hasLocalCode: false,
    }
  })
  await Promise.all(presets.map(async (preset) => {
    if (!preset.path) return
    let cordis = ''
    try { cordis = await readFile(join(preset.path, 'agent.cordis.yml'), 'utf8') } catch { /* ignore */ }
    preset.hasLocalCode = await detectHasLocalCode(preset.path, [cordis])
  }))
  return { ...roster, presets }
}

export async function validatePresetDirectory(dirPath, { shippedIds = new Set() } = {}) {
  const errors = []
  const abs = resolve(dirPath)
  let st
  try {
    st = await stat(abs)
  } catch {
    return { ok: false, errors: ['目录不存在或不可读'] }
  }
  if (!st.isDirectory()) errors.push('路径必须是目录')
  const id = basename(abs)
  if (!PRESET_ID_RE.test(id)) errors.push('目录名必须符合 preset id 规则（小写字母数字开头）')
  if (shippedIds.has(id)) errors.push(`id 与随包 preset 冲突：${id}`)
  const cordisPath = join(abs, 'agent.cordis.yml')
  let cordis = ''
  try {
    cordis = await readFile(cordisPath, 'utf8')
  } catch {
    errors.push('缺少 agent.cordis.yml')
  }
  if (cordis && !/^[\s\S]*\S[\s\S]*$/u.test(cordis)) errors.push('agent.cordis.yml 为空')
  let presetMeta = { name: '', description: '' }
  try {
    const presetYml = await readFile(join(abs, 'preset.yml'), 'utf8')
    presetMeta = parsePresetMeta(presetYml)
  } catch {
    /* optional */
  }
  const files = await listFilesRecursive(abs)
  const warnings = []
  const hasLocalCode = await detectHasLocalCode(abs, [cordis])
  if (hasLocalCode) warnings.push('含本地代码或 !!js，将以 shell 级信任运行，请先审查')
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    preview: {
      id,
      name: presetMeta.name || id,
      description: presetMeta.description || '',
      files,
      hasLocalCode,
      warnings,
    },
  }
}

async function shippedPresetIds(aiRuntime) {
  const index = await buildPresetPathIndex(aiRuntime)
  const ids = new Set(['standard', 'ptc', 'minimal', 'cordis'])
  for (const [id, entry] of index) {
    if (entry.kind === 'shipped') ids.add(id)
  }
  return ids
}

async function copyPresetIntoUserHome(aiRuntime, sourceDir, id) {
  const dest = join(aiRuntime.dshHome, '.agent-presets', id)
  await mkdir(join(aiRuntime.dshHome, '.agent-presets'), { recursive: true })
  await cp(sourceDir, dest, { recursive: true, force: true })
  return dest
}

export async function handlePresetRoutes(request, response, url, ctx) {
  const { aiRuntime, currentCorrelationId, sendJson, sendError, readJson } = ctx

  if (request.method === 'GET' && url.pathname === '/api/v1/ai/presets') {
    const roster = await aiRuntime.call('agentPresets/list')
    const enriched = await enrichPresetList(aiRuntime, roster)
    sendJson(response, 200, { data: enriched, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/ai/presets/import-dir') {
    const body = await readJson(request)
    const path = typeof body.path === 'string' ? body.path.trim() : ''
    if (!path.startsWith('/')) {
      sendError(response, 400, 'validation_error', '请填写本机绝对路径', currentCorrelationId)
      return true
    }
    const shippedIds = await shippedPresetIds(aiRuntime)
    const result = await validatePresetDirectory(path, { shippedIds })
    if (!result.ok) {
      sendError(response, 422, 'validation_error', result.errors.join('；'), currentCorrelationId, { errors: result.errors })
      return true
    }
    sendJson(response, 200, { data: { ok: true, preview: result.preview }, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/ai/presets/import-dir/confirm') {
    const body = await readJson(request)
    const path = typeof body.path === 'string' ? body.path.trim() : ''
    const overrideId = typeof body.id === 'string' ? body.id.trim() : ''
    if (!path.startsWith('/')) {
      sendError(response, 400, 'validation_error', 'path 无效', currentCorrelationId)
      return true
    }
    const shippedIds = await shippedPresetIds(aiRuntime)
    const checked = await validatePresetDirectory(path, { shippedIds })
    if (!checked.ok) {
      sendError(response, 422, 'validation_error', checked.errors.join('；'), currentCorrelationId)
      return true
    }
    let id = checked.preview.id
    if (overrideId) {
      if (!PRESET_ID_RE.test(overrideId)) {
        sendError(response, 422, 'validation_error', '自定义 id 不符合规则', currentCorrelationId)
        return true
      }
      if (shippedIds.has(overrideId)) {
        sendError(response, 409, 'id_conflict', 'id 与随包 preset 冲突', currentCorrelationId)
        return true
      }
      id = overrideId
    }
    const userDest = join(aiRuntime.dshHome, '.agent-presets', id)
    if (existsSync(userDest) && id !== checked.preview.id) {
      sendError(response, 409, 'id_conflict', '目标 id 已存在', currentCorrelationId)
      return true
    }
    await copyPresetIntoUserHome(aiRuntime, resolve(path), id)
    sendJson(response, 200, {
      data: { ok: true, id, hint: '新会话时可见；若未出现请重载核心' },
      correlationId: currentCorrelationId,
    })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/ai/presets/import-git') {
    if (process.env.FDE_ALLOW_GIT_IMPORT !== '1') {
      sendError(response, 501, 'git_import_disabled', 'Git 导入未开启。请在 peer 栈环境变量设置 FDE_ALLOW_GIT_IMPORT=1 后重启 runtime', currentCorrelationId)
      return true
    }
    const body = await readJson(request)
    const repoUrl = typeof body.url === 'string' ? body.url.trim() : ''
    const subdir = typeof body.subdir === 'string' ? body.subdir.trim().replace(/^\/+|\/+$/g, '') : ''
    if (!repoUrl.startsWith('https://') && !repoUrl.startsWith('git@')) {
      sendError(response, 400, 'validation_error', '请填写可 clone 的 Git 地址', currentCorrelationId)
      return true
    }
    const tempPath = join(aiRuntime.dshHome, 'tmp', `preset-${createId('git').replace(/^git_/, '')}`)
    await mkdir(join(aiRuntime.dshHome, 'tmp'), { recursive: true })
    try {
      await execFileAsync('git', ['clone', '--depth', '1', repoUrl, tempPath], { timeout: 30000 })
    } catch (error) {
      const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr || '') : String(error)
      sendError(response, 502, 'git_clone_failed', `git clone 失败：${stderr.slice(0, 240)}`, currentCorrelationId)
      return true
    }
    const targetDir = subdir ? join(tempPath, subdir) : tempPath
    const shippedIds = await shippedPresetIds(aiRuntime)
    const result = await validatePresetDirectory(targetDir, { shippedIds })
    if (!result.ok) {
      await rm(tempPath, { recursive: true, force: true })
      sendError(response, 422, 'validation_error', result.errors.join('；'), currentCorrelationId, { errors: result.errors })
      return true
    }
    sendJson(response, 200, {
      data: { ok: true, preview: result.preview, tempPath: targetDir, cloneRoot: tempPath },
      correlationId: currentCorrelationId,
    })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/ai/presets/import-git/confirm') {
    const body = await readJson(request)
    const tempPath = typeof body.tempPath === 'string' ? body.tempPath.trim() : ''
    const cloneRoot = typeof body.cloneRoot === 'string' ? body.cloneRoot.trim() : ''
    const overrideId = typeof body.id === 'string' ? body.id.trim() : ''
    if (!tempPath.startsWith('/')) {
      sendError(response, 400, 'validation_error', 'tempPath 无效', currentCorrelationId)
      return true
    }
    const shippedIds = await shippedPresetIds(aiRuntime)
    const checked = await validatePresetDirectory(tempPath, { shippedIds })
    if (!checked.ok) {
      sendError(response, 422, 'validation_error', checked.errors.join('；'), currentCorrelationId)
      return true
    }
    let id = checked.preview.id
    if (overrideId) {
      if (!PRESET_ID_RE.test(overrideId)) {
        sendError(response, 422, 'validation_error', '自定义 id 不符合规则', currentCorrelationId)
        return true
      }
      if (shippedIds.has(overrideId)) {
        sendError(response, 409, 'id_conflict', 'id 与随包 preset 冲突', currentCorrelationId)
        return true
      }
      id = overrideId
    }
    await copyPresetIntoUserHome(aiRuntime, resolve(tempPath), id)
    if (cloneRoot) {
      try { await rm(cloneRoot, { recursive: true, force: true }) } catch (error) {
        console.warn('preset import git cleanup failed', error)
      }
    } else {
      const parent = resolve(tempPath, '..')
      if (parent.startsWith(join(aiRuntime.dshHome, 'tmp'))) {
        try { await rm(parent, { recursive: true, force: true }) } catch (error) {
          console.warn('preset import git cleanup failed', error)
        }
      }
    }
    sendJson(response, 200, {
      data: { ok: true, id, hint: '新会话时可见；若未出现请重载核心' },
      correlationId: currentCorrelationId,
    })
    return true
  }

  const deleteMatch = url.pathname.match(/^\/api\/v1\/ai\/presets\/([^/]+)$/)
  if (request.method === 'DELETE' && deleteMatch) {
    const id = decodeURIComponent(deleteMatch[1])
    const roster = await aiRuntime.call('agentPresets/list')
    const enriched = await enrichPresetList(aiRuntime, roster)
    const preset = enriched.presets.find((row) => row.id === id)
    if (!preset) {
      sendError(response, 404, 'not_found', 'preset 不存在', currentCorrelationId)
      return true
    }
    if (preset.source !== 'user') {
      sendError(response, 403, 'forbidden', '只能删除用户导入的 preset', currentCorrelationId)
      return true
    }
    const userDir = join(aiRuntime.dshHome, '.agent-presets', id)
    try {
      await rm(userDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('preset delete rm failed', error)
    }
    try {
      await aiRuntime.call('agentPresets/deletePreset', { id })
    } catch (error) {
      console.warn('preset deletePreset rpc failed', error)
    }
    const next = await enrichPresetList(aiRuntime, await aiRuntime.call('agentPresets/list'))
    sendJson(response, 200, { data: next, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/ai/presets/copy') {
    const body = await readJson(request)
    const from = String(body.from || '').trim()
    const id = String(body.id || '').trim()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!from || !id) {
      sendError(response, 400, 'validation_error', 'from 和 id 不能为空', currentCorrelationId)
      return true
    }
    await aiRuntime.call('agentPresets/copy', { from, id, name: name || undefined })
    const roster = await enrichPresetList(aiRuntime, await aiRuntime.call('agentPresets/list'))
    sendJson(response, 200, { data: roster, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/ai/presets/delete') {
    const body = await readJson(request)
    const id = String(body.id || '').trim()
    if (!id) {
      sendError(response, 400, 'validation_error', 'id 不能为空', currentCorrelationId)
      return true
    }
    const roster = await aiRuntime.call('agentPresets/list')
    const enriched = await enrichPresetList(aiRuntime, roster)
    const preset = enriched.presets.find((row) => row.id === id)
    if (preset && preset.source !== 'user') {
      sendError(response, 403, 'forbidden', '只能删除用户导入的 preset', currentCorrelationId)
      return true
    }
    await aiRuntime.call('agentPresets/deletePreset', { id })
    const next = await enrichPresetList(aiRuntime, await aiRuntime.call('agentPresets/list'))
    sendJson(response, 200, { data: next, correlationId: currentCorrelationId })
    return true
  }

  return false
}
