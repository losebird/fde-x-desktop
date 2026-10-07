import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { collectBag } from '../catalog-collect.mjs'
import {
  bundleRootFromPath,
  confinedRelPath,
  installSkillBundle,
  listBundleFiles,
  setSkillModelInvocable,
  skillManifestPath,
  skillRootsForCwd,
  uninstallSkillBundle,
} from '../skill-bundle.mjs'

function cwdFrom(url, body) {
  const raw = (body && (body.cwd || body.workspace))
    || (url && (url.searchParams.get('cwd') || url.searchParams.get('workspace')))
    || ''
  return String(raw || '').trim()
}

function sessionFrom(url, body) {
  const raw = (body && body.sessionId)
    || (url && url.searchParams.get('sessionId'))
    || ''
  return String(raw || '').trim()
}

async function managedBundle(aiRuntime, { cwd, sessionId, skillPath }) {
  const bag = await collectBag(aiRuntime, 'skill', { cwd, sessionId })
  const items = Array.isArray(bag.raw?.items) ? bag.raw.items : []
  const row = items.find((item) => item && item.origin === 'catalog' && item.path === skillPath)
  if (!row) {
    const err = new Error('bundle_not_in_roots')
    err.code = 'bundle_not_in_roots'
    throw err
  }
  return { bundleRoot: row.bundleRoot || bundleRootFromPath(skillPath) }
}

export async function handleSkillRoutes(request, response, url, ctx) {
  const { aiRuntime, currentCorrelationId, sendJson, sendError, readJson } = ctx

  if (request.method === 'GET' && url.pathname === '/api/v1/skills/roots') {
    const cwd = cwdFrom(url)
    const roots = await skillRootsForCwd(aiRuntime, cwd)
    sendJson(response, 200, { data: { roots }, correlationId: currentCorrelationId })
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/skills/bundle/files') {
    const skillPath = url.searchParams.get('path') || ''
    const cwd = cwdFrom(url)
    const sessionId = sessionFrom(url)
    if (!skillPath) {
      sendError(response, 400, 'validation_error', '缺少 path', currentCorrelationId)
      return true
    }
    try {
      const { bundleRoot } = await managedBundle(aiRuntime, { cwd, sessionId, skillPath })
      const files = await listBundleFiles(bundleRoot)
      sendJson(response, 200, { data: { bundleRoot, files }, correlationId: currentCorrelationId })
    } catch (error) {
      sendError(response, error.code === 'bundle_not_in_roots' ? 403 : 400, error.code || 'skill_bundle', error.message, currentCorrelationId)
    }
    return true
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/skills/bundle/file') {
    const skillPath = url.searchParams.get('path') || ''
    const rel = url.searchParams.get('rel') || ''
    const cwd = cwdFrom(url)
    const sessionId = sessionFrom(url)
    try {
      const { bundleRoot } = await managedBundle(aiRuntime, { cwd, sessionId, skillPath })
      const target = confinedRelPath(bundleRoot, rel)
      const text = await readFile(target.abs, 'utf8')
      sendJson(response, 200, { data: { rel: target.rel, text }, correlationId: currentCorrelationId })
    } catch (error) {
      sendError(response, error.code === 'path_outside_bundle' || error.code === 'bundle_not_in_roots' ? 403 : 400, error.code || 'skill_bundle', error.message, currentCorrelationId)
    }
    return true
  }

  if (request.method === 'PUT' && url.pathname === '/api/v1/skills/bundle/file') {
    const body = await readJson(request)
    const skillPath = typeof body.path === 'string' ? body.path : ''
    const rel = typeof body.rel === 'string' ? body.rel : ''
    const text = typeof body.text === 'string' ? body.text : ''
    const cwd = cwdFrom(url, body)
    const sessionId = sessionFrom(url, body)
    try {
      const { bundleRoot } = await managedBundle(aiRuntime, { cwd, sessionId, skillPath })
      const target = confinedRelPath(bundleRoot, rel)
      if (!target.rel) {
        sendError(response, 400, 'validation_error', '缺少 rel', currentCorrelationId)
        return true
      }
      await mkdir(dirname(target.abs), { recursive: true })
      await writeFile(target.abs, text)
      sendJson(response, 200, { data: { rel: target.rel }, correlationId: currentCorrelationId })
    } catch (error) {
      sendError(response, error.code === 'path_outside_bundle' || error.code === 'bundle_not_in_roots' ? 403 : 400, error.code || 'skill_bundle', error.message, currentCorrelationId)
    }
    return true
  }

  if (request.method === 'DELETE' && url.pathname === '/api/v1/skills/bundle/file') {
    const skillPath = url.searchParams.get('path') || ''
    const rel = url.searchParams.get('rel') || ''
    const cwd = cwdFrom(url)
    const sessionId = sessionFrom(url)
    try {
      const { bundleRoot } = await managedBundle(aiRuntime, { cwd, sessionId, skillPath })
      const target = confinedRelPath(bundleRoot, rel)
      if (!target.rel) {
        sendError(response, 400, 'validation_error', '缺少 rel', currentCorrelationId)
        return true
      }
      await rm(target.abs, { recursive: true, force: true })
      sendJson(response, 200, { data: { rel: target.rel }, correlationId: currentCorrelationId })
    } catch (error) {
      sendError(response, error.code === 'path_outside_bundle' || error.code === 'bundle_not_in_roots' ? 403 : 400, error.code || 'skill_bundle', error.message, currentCorrelationId)
    }
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/skills/model-invocable') {
    const body = await readJson(request)
    const skillPath = typeof body.path === 'string' ? body.path : ''
    const modelInvocable = Boolean(body.modelInvocable)
    const cwd = cwdFrom(url, body)
    const sessionId = sessionFrom(url, body)
    try {
      const { bundleRoot } = await managedBundle(aiRuntime, { cwd, sessionId, skillPath })
      const manifest = skillManifestPath(bundleRoot)
      await setSkillModelInvocable(manifest, modelInvocable)
      sendJson(response, 200, { data: { path: skillPath, modelInvocable }, correlationId: currentCorrelationId })
    } catch (error) {
      sendError(response, error.code === 'bundle_not_in_roots' ? 403 : 400, error.code || 'skill_bundle', error.message, currentCorrelationId)
    }
    return true
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/skills/install') {
    const body = await readJson(request)
    const source = typeof body.source === 'string' ? body.source.trim() : ''
    const root = typeof body.root === 'string' ? body.root.trim() : ''
    const cwd = cwdFrom(url, body)
    if (!source || !root) {
      sendError(response, 400, 'validation_error', '需要 source 和 root', currentCorrelationId)
      return true
    }
    try {
      const roots = await skillRootsForCwd(aiRuntime, cwd)
      if (!roots.some((row) => row.path === root)) {
        sendError(response, 403, 'bundle_not_in_roots', '安装根不在当前技能根里', currentCorrelationId)
        return true
      }
      const installed = await installSkillBundle({ source, root })
      sendJson(response, 201, { data: installed, correlationId: currentCorrelationId })
    } catch (error) {
      sendError(response, 400, error.code || 'skill_bundle', error.message, currentCorrelationId)
    }
    return true
  }

  if (request.method === 'DELETE' && url.pathname === '/api/v1/skills/bundle') {
    const skillPath = url.searchParams.get('path') || ''
    const cwd = cwdFrom(url)
    const sessionId = sessionFrom(url)
    try {
      const { bundleRoot } = await managedBundle(aiRuntime, { cwd, sessionId, skillPath })
      await uninstallSkillBundle(bundleRoot)
      sendJson(response, 200, { data: { path: skillPath }, correlationId: currentCorrelationId })
    } catch (error) {
      sendError(response, error.code === 'bundle_not_in_roots' ? 403 : 400, error.code || 'skill_bundle', error.message, currentCorrelationId)
    }
    return true
  }

  return false
}
