/**
 * Open a workspace office copy in dsh-univer-office. Never the IM original.
 * @module dsh-lan-assist/univer-open
 */

import { access } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'
import { realpath } from 'node:fs/promises'

const OFFICE = new Set(['.xlsx', '.csv', '.tsv', '.docx', '.pptx', '.univer'])

function worktreeIdOf(got) {
  const row = got && got.result && typeof got.result === 'object' ? got.result : got
  return String((row && (row.worktreeId || row.id)) || '').trim()
}

function viewerUrlOf(state) {
  if (!state || typeof state !== 'object') return ''
  const trees = Array.isArray(state.worktrees) ? state.worktrees : []
  for (const row of trees) {
    const url = String((row && row.openUrl) || '').trim()
    if (url) return url
  }
  return String(state.viewerUrl || '').trim()
}

async function underWorkspace(cwd, rel) {
  const root = await realpath(String(cwd || ''))
  const raw = String(rel || '').trim()
  if (!raw) {
    const err = new Error('NO_PATH')
    err.code = 'NO_PATH'
    throw err
  }
  const candidate = resolve(root, raw)
  const real = await realpath(candidate)
  const from = relative(root, real)
  if (!from || from === '..' || from.startsWith(`..${sep}`) || from.startsWith(sep)) {
    const err = new Error('OUTSIDE')
    err.code = 'OUTSIDE'
    throw err
  }
  return { root, path: real }
}

export async function openUniverFile(univer, spec = {}) {
  if (!univer || typeof univer.fileState !== 'function') {
    return { ok: false, error: 'NO_UNIVER', hint: '没装 dsh-univer-office。' }
  }
  const cwd = String(spec.workspace || '').trim()
  if (!cwd) return { ok: false, error: 'NO_CWD', hint: '这封没绑工作区，不能用 Univer。' }
  let placed
  try {
    placed = await underWorkspace(cwd, spec.path)
  } catch (error) {
    const code = error && error.code
    if (code === 'NO_PATH') return { ok: false, error: 'NO_PATH', hint: '先另存到工作区再打开。' }
    return { ok: false, error: 'OUTSIDE', hint: '只能打开工作区里的副本。' }
  }
  const ext = extname(placed.path).toLowerCase()
  if (!OFFICE.has(ext)) {
    return { ok: false, error: 'NOT_OFFICE', hint: 'Univer 只开 xlsx / csv / docx / pptx / univer。' }
  }
  if (typeof univer.ensureGateway === 'function') {
    const gate = await univer.ensureGateway()
    if (gate && gate.ok === false) {
      return { ok: false, error: 'NO_GATEWAY', hint: (gate.reason && String(gate.reason)) || 'Univer 网关没起来。' }
    }
  }
  let file = placed.path
  if (ext !== '.univer') {
    file = resolve(dirname(placed.path), `${basename(placed.path, ext)}.univer`)
    let exists = true
    try { await access(file) } catch { exists = false }
    if (!exists) {
      if (typeof univer.newFile !== 'function' || typeof univer.worktree !== 'function' || typeof univer.importUnitContent !== 'function') {
        return { ok: false, error: 'NO_UNIVER', hint: 'Univer 不能导入这份文件。' }
      }
      await univer.newFile({ workspace: placed.root, file })
      const tree = await univer.worktree({ workspace: placed.root, file, action: 'create', name: 'edit' })
      const worktreeId = worktreeIdOf(tree)
      if (!worktreeId) return { ok: false, error: 'NO_WORKTREE', hint: 'Univer 草稿没建成。' }
      await univer.importUnitContent({
        workspace: placed.root,
        file,
        sourceWorkspace: placed.root,
        source: placed.path,
        worktreeId,
        name: basename(placed.path, ext),
      })
    }
  }
  const state = await univer.fileState({ workspace: placed.root, file })
  const url = viewerUrlOf(state)
  if (!url) return { ok: false, error: 'NO_VIEWER', hint: 'Univer 没给出预览地址。' }
  return { ok: true, url, file, source: placed.path }
}
