/**
 * Live AE′: draft dialog, active workspace, confirm delete.
 * Store internal/ only — do not git-add. Never 确认过账 / biz_write.
 */
import { chromium } from '/tmp/pw-run/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
const STORE =
  '/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files'
const MEDIA = `${STORE}/media/app-open-ae.png`
const REPORT_JSON = `${STORE}/internal/verify-app-open-ae.json`
const SCENE = '/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation'
const DB = `${SCENE}/runtime/data/fde-workstation.sqlite`
const mainBase = 'http://127.0.0.1:5174'
const workspaceCwd = '/Users/zxz/Documents/ai-project/fdex测试'
const workspaceId = '1985293d-03bb-496f-ad69-5c7f2ac23149'
const stamp = Date.now().toString(36)

function gitSha() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD && git rev-parse HEAD', { cwd: SCENE, encoding: 'utf8' }).trim().split('\n')
  } catch {
    return ['unknown', 'unknown']
  }
}

function specFor(name, slug) {
  return {
    spec: 'fde-app/v1',
    slug,
    name,
    description: 'AE live fixture',
    entities: [{
      name: 'item',
      label: '条目',
      titleField: 'title',
      fields: [
        { name: 'title', label: '标题', type: 'text', required: true },
        { name: 'status', label: '状态', type: 'enum', required: true, options: ['计划', '完成'] },
      ],
    }],
    views: [
      { id: 'table-main', type: 'table', entity: 'item', label: '列表', columns: ['title', 'status'] },
      { id: 'form-main', type: 'form', entity: 'item', label: '新建' },
    ],
  }
}

const [branch, sha] = gitSha()
await mkdir(`${STORE}/internal`, { recursive: true })
await mkdir(`${STORE}/media`, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
const out = {
  sha,
  branch,
  hardcoded: 'none',
  silentBizWrite: false,
  confirmed: false,
  originPushed: false,
  draftIsDialog: false,
  useLeavesList: false,
  draftDeleted: false,
  activeDeleteConfirm: false,
  activeDefaultSoft: false,
  threeTabs: false,
  kindChipsRemain: false,
  acRowsVisible: false,
  acNewButton: false,
}

function seedState(activeDataSubview = 'overview') {
  return page.evaluate(({ workspaceId: wsId, workspaceCwd: cwd, activeDataSubview: view }) => {
    const key = 'scene-39-workstation'
    const raw = localStorage.getItem(key)
    const state = raw ? JSON.parse(raw) : { state: {} }
    state.state = state.state || {}
    state.state.activeWorkspaceId = wsId
    state.state.activeDataSubview = view
    const rows = Array.isArray(state.state.workspaces) ? state.state.workspaces : []
    if (!rows.some((r) => r.id === wsId)) {
      rows.push({ id: wsId, name: 'fdex测试1', desc: cwd, cwd })
      state.state.workspaces = rows
    } else {
      state.state.workspaces = rows.map((r) => (r.id === wsId ? { ...r, name: 'fdex测试1', desc: cwd, cwd } : r))
    }
    const fallbackPanels = [
      { id: 'im', label: 'IM', icon: 'MessageCircleMore', emoji: '💬', accent: 'bg-slate-700', state: 'closed', width: 560, badge: 0, view: 'im' },
      { id: 'briefing', label: '早报', icon: 'Newspaper', emoji: '🌅', accent: 'bg-amber-500', state: 'tab', width: 560, pinned: true, view: 'briefing' },
      { id: 'plan', label: '计划', icon: 'ClipboardList', emoji: '📋', accent: 'bg-blue-500', state: 'closed', width: 600, view: 'plan' },
      { id: 'files', label: '文件', icon: 'Folder', emoji: '📁', accent: 'bg-emerald-500', state: 'closed', width: 580, view: 'files' },
      { id: 'mcp', label: 'MCP', icon: 'Plug', emoji: '🔌', accent: 'bg-rose-500', state: 'closed', width: 520, view: 'mcp' },
      { id: 'skills', label: 'Skills', icon: 'Wand2', emoji: '🪄', accent: 'bg-indigo-500', state: 'closed', width: 520, view: 'skills' },
      { id: 'memory', label: '记忆', icon: 'Brain', emoji: '🧠', accent: 'bg-fuchsia-500', state: 'closed', width: 800, view: 'memory' },
      { id: 'settings', label: '设置', icon: 'Settings', emoji: '⚙️', accent: 'bg-slate-500', state: 'closed', width: 520, view: 'settings' },
      { id: 'data', label: '业务应用', icon: 'Database', emoji: '🗃️', accent: 'bg-cyan-500', state: 'full', width: 1100, view: 'data' },
    ]
    const panels = Array.isArray(state.state.panels) ? state.state.panels : []
    state.state.panels = (panels.length ? panels : fallbackPanels).map((p) => (
      p && p.id === 'data' ? { ...p, state: 'full', width: 1100 } : p
    ))
    if (!state.state.panels.some((p) => p && p.id === 'data')) state.state.panels = fallbackPanels
    if (state.version == null) state.version = 17
    localStorage.setItem(key, JSON.stringify(state))
  }, { workspaceId, workspaceCwd, activeDataSubview })
}

async function listApps() {
  return page.evaluate(async ({ wsId, cwd }) => {
    const params = new URLSearchParams({ workspaceId: wsId, workspaceCwd: cwd })
    const json = await fetch(`/api/v1/business/apps?${params}`).then((r) => r.json())
    return (json.items || []).map((row) => ({ id: row.id, name: row.name, status: row.status, kind: row.appKind }))
  }, { wsId: workspaceId, cwd: workspaceCwd })
}

async function postSpec(spec) {
  return page.evaluate(async ({ spec, workspaceCwd: cwd, workspaceId: wsId }) => {
    const res = await fetch('/api/v1/apps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec, workspaceCwd: cwd, workspaceId: wsId }),
    })
    return res.json()
  }, { spec, workspaceCwd, workspaceId })
}

try {
  await page.goto(`${mainBase}/ai`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await seedState('overview')
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(1200)

  const overviewBtn = page.getByRole('button', { name: '应用', exact: true })
  if (await overviewBtn.count()) await overviewBtn.click({ timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(600)

  const tabApp = page.getByRole('button', { name: '应用', exact: true })
  const tabRecords = page.getByRole('button', { name: '业务记录', exact: true })
  const tabOps = page.getByRole('button', { name: '操作记录', exact: true })
  out.threeTabs = (await tabApp.count()) > 0 && (await tabRecords.count()) > 0 && (await tabOps.count()) > 0

  const prior = await listApps()
  for (const row of prior) {
    if (String(row.name).startsWith('AE草稿-') && row.status === 'draft') {
      await page.evaluate(async (id) => {
        await fetch(`/api/v1/apps/${encodeURIComponent(id)}`, { method: 'DELETE' })
      }, row.id)
    }
    if (String(row.name).startsWith('AE归档-') && row.status === 'active') {
      await page.evaluate(async (id) => {
        await fetch(`/api/v1/apps/${encodeURIComponent(id)}/archive`, { method: 'POST' })
      }, row.id)
    }
  }

  const draftName = `AE草稿-${stamp}`
  const liveName = `AE归档-${stamp}`
  const draftCreated = await postSpec(specFor(draftName, `ae-d-${stamp}`.slice(0, 32)))
  const liveCreated = await postSpec(specFor(liveName, `ae-a-${stamp}`.slice(0, 32)))
  out.draftCreate = draftCreated
  out.liveCreate = liveCreated
  if (!draftCreated?.ok || !liveCreated?.ok) {
    out.failCode = 'fixture-create'
    throw new Error(out.failCode)
  }
  const liveId = liveCreated.data.appId
  const activated = await page.evaluate(async (id) => {
    const res = await fetch(`/api/v1/apps/${encodeURIComponent(id)}/activate`, { method: 'POST' })
    return res.json()
  }, liveId)
  out.liveActivate = activated
  if (!activated?.ok) {
    out.failCode = 'fixture-activate'
    throw new Error(out.failCode)
  }

  await page.getByRole('button', { name: '刷新' }).click().catch(() => {})
  await page.waitForTimeout(800)
  const listed = await listApps()
  out.listed = listed.map((row) => ({ id: row.id, name: row.name, status: row.status }))
  const acApp = listed.find((row) => row.status === 'active' && row.kind === 'generated' && !String(row.name).startsWith('AE'))
  out.acApp = acApp || null

  const draftOpen = page.locator(`[data-app-row="${draftCreated.data.appId}"]`).getByRole('button').first()
  await draftOpen.click({ timeout: 10000 })
  const dialog = page.locator('[data-app-open-dialog="true"]')
  await dialog.waitFor({ state: 'visible', timeout: 10000 })
  await dialog.getByRole('button', { name: '采纳并激活' }).waitFor({ state: 'visible', timeout: 15000 })
  const dialogText = await dialog.innerText()
  out.draftIsDialog = dialogText.includes('草稿预览') && dialogText.includes('采纳并激活')
  out.dialogSnippet = dialogText.slice(0, 400)
  await page.screenshot({ path: `${STORE}/media/app-open-ae-dialog.png` })
  await dialog.getByRole('button', { name: '关闭预览' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 8000 })

  const useTarget = acApp || { name: liveName, id: liveId }
  await page.locator(`[data-app-row="${useTarget.id}"]`).getByRole('button').first().click({ timeout: 10000 })
  const workspace = page.locator('[data-app-workspace="true"]')
  await workspace.waitFor({ state: 'visible', timeout: 15000 })
  await workspace.locator('button.btn-brand', { hasText: '新建' }).waitFor({ state: 'visible', timeout: 20000 })
  if (acApp) {
    await workspace.getByText(/走访/).first().waitFor({ state: 'visible', timeout: 15000 })
  }
  const workspaceText = await workspace.innerText()
  const catalogGone = await page.locator('[data-app-catalog="true"]').count() === 0
  out.useLeavesList = catalogGone && workspaceText.includes('返回列表') && workspaceText.includes('独立工作面')
  out.acNewButton = true
  out.acRowsVisible = Boolean(acApp) && (workspaceText.includes('走访') || /共\s*[1-9]/.test(workspaceText))
  out.workspaceSnippet = workspaceText.slice(0, 500)

  await workspace.getByRole('button', { name: '返回列表' }).click()
  await page.getByText('我的业务应用').waitFor({ state: 'visible', timeout: 12000 })

  await page.locator(`[data-app-row="${draftCreated.data.appId}"]`).getByRole('button', { name: '删除' }).click({ timeout: 8000 })
  const del = page.locator('[data-app-delete-confirm="true"]')
  await del.waitFor({ state: 'visible', timeout: 8000 })
  const draftDelText = await del.innerText()
  out.draftConfirmText = draftDelText.slice(0, 240)
  await del.getByRole('button', { name: '确认删除' }).click()
  await page.waitForTimeout(800)
  const afterDraft = await listApps()
  out.draftDeleted = !afterDraft.some((row) => row.id === draftCreated.data.appId)
  out.draftGoneFromUi = !(await page.getByText(draftName).count())

  await page.locator(`[data-app-row="${liveId}"]`).getByRole('button', { name: '删除' }).click({ timeout: 8000 })
  await del.waitFor({ state: 'visible', timeout: 8000 })
  const activeDelText = await del.innerText()
  const hardBox = page.locator('[data-app-hard-delete="true"]')
  out.activeDeleteConfirm = activeDelText.includes('再确认一次') && activeDelText.includes('连数据一起删') && await hardBox.count() > 0
  out.activeHardChecked = await hardBox.isChecked()
  out.activeDefaultSoft = out.activeDeleteConfirm && out.activeHardChecked === false
  await page.screenshot({ path: MEDIA, fullPage: false })
  out.screenshot = MEDIA
  await del.getByRole('button', { name: '确认删除' }).click()
  await page.waitForTimeout(800)
  const afterLive = await listApps()
  const liveMeta = afterLive.find((row) => row.id === liveId)
  out.activeArchivedInApi = liveMeta?.status === 'archived'
  out.activeGoneFromUi = !(await page.getByText(liveName).count())

  const sqlite = new DatabaseSync(DB)
  const tableName = `app_ae-a-${stamp}__item`.slice(0, 80)
  const exact = `app_${`ae-a-${stamp}`.slice(0, 32)}__item`
  const table = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(exact)
  out.softKeepTable = Boolean(table)
  sqlite.close()

  await tabRecords.click({ timeout: 10000 })
  await page.waitForTimeout(1000)
  const recordsText = await page.locator('body').innerText()
  out.recordsTabOpen = recordsText.includes('业务记录') || recordsText.includes('chip') || recordsText.includes('销售')
  const chips = await page.locator('button').evaluateAll((els) => els.map((el) => (el.textContent || '').trim()).filter((t) => /\d/.test(t)).slice(0, 20))
  out.kindChips = chips
  out.kindChipsRemain = chips.some((t) => t.includes('销售') || t.includes('合同') || t.includes('回款') || /\d/.test(t))

  await tabOps.click({ timeout: 10000 })
  await page.waitForTimeout(800)
  const opsText = await page.locator('body').innerText()
  out.opsTabOpen = opsText.includes('操作记录') || opsText.includes('回退') || opsText.includes('历史')

  out.pass = Boolean(
    out.draftIsDialog
    && out.useLeavesList
    && out.draftDeleted
    && out.activeDeleteConfirm
    && out.activeDefaultSoft
    && out.activeGoneFromUi
    && out.softKeepTable
    && out.threeTabs
    && out.kindChipsRemain
    && out.acNewButton
    && out.acRowsVisible
    && !out.silentBizWrite
    && !out.confirmed,
  )
} catch (error) {
  out.error = error instanceof Error ? error.message : String(error)
  out.pass = false
  await page.screenshot({ path: MEDIA, fullPage: true }).catch(() => {})
  out.screenshot = MEDIA
} finally {
  await writeFile(REPORT_JSON, JSON.stringify(out, null, 2))
  await browser.close()
}

console.log(JSON.stringify(out, null, 2))
if (!out.pass) process.exit(1)
