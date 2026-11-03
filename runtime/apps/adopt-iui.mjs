import { writeBundleFiles } from './bundle.mjs'
import { activateApp, createAppDraft, isSlugTaken } from './repository.mjs'
import { isWebAppSpec } from './spec.mjs'

const SLUG_RE = /^[a-z][a-z0-9-]{1,30}$/

export function slugFromTitle(title) {
  const ascii = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 31)
    .replace(/-+$/g, '')
  if (SLUG_RE.test(ascii)) return ascii
  return `iui-${Date.now().toString(36).slice(-8)}`
}

export function nameFromTitle(title) {
  const name = String(title || '').trim().slice(0, 40)
  return name || 'IUI 页面'
}

function uniqueSlug(db, workspaceId, base) {
  let slug = base
  let n = 2
  while (isSlugTaken(db, workspaceId, slug, '', { activeOnly: true })) {
    const suffix = `-${n}`
    slug = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`
    n += 1
    if (n > 50) return `iui-${Date.now().toString(36).slice(-8)}`
  }
  return slug
}

/**
 * Persist an IUI sandbox HTML page as an activated fde-web/v1 app.
 * @param {{ db: import('node:sqlite').DatabaseSync, workspaceId: string, workspaceCwd: string, title?: string, html: string }} input
 */
export function adoptIuiPage(input) {
  const html = String(input.html || '').trim()
  if (!html) return { ok: false, errors: [{ path: 'html', message: '页面是空的' }] }
  const cwd = String(input.workspaceCwd || '').trim()
  if (!cwd) return { ok: false, errors: [{ path: 'workspaceCwd', message: '没有工作区' }] }
  const slug = uniqueSlug(input.db, input.workspaceId, slugFromTitle(input.title))
  const name = nameFromTitle(input.title)
  const spec = {
    spec: 'fde-web/v1',
    slug,
    name,
    bundleRoot: `apps/${slug}`,
    entry: 'index.html',
  }
  const created = createAppDraft(input.db, {
    workspaceId: input.workspaceId,
    workspaceCwd: cwd,
    spec,
  })
  if (!created.ok) return { ok: false, errors: created.errors }
  const appId = created.data.appId
  try {
    writeBundleFiles(cwd, spec, [{ path: 'index.html', content: html }])
  } catch (error) {
    return { ok: false, errors: [{ path: 'files', message: error instanceof Error ? error.message : '写包失败' }] }
  }
  const app = { spec: { ...spec, _workspaceCwd: cwd } }
  if (!isWebAppSpec(app.spec)) {
    return { ok: false, errors: [{ path: 'spec', message: '不是 Web 应用' }] }
  }
  const activated = activateApp(input.db, appId, { workspaceId: input.workspaceId })
  if (activated.kind !== 'ok') {
    return {
      ok: false,
      errors: activated.errors || [{ path: 'activate', message: activated.kind || '激活失败' }],
    }
  }
  return { ok: true, appId, slug, name, revision: created.data.revision }
}
