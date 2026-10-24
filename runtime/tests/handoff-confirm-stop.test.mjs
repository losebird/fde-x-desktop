import './support/no-stray-processes.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { briefFollowup } from '../plugins/dsh-lan-assist/catalog.js'
import { taskHandoffPrompt } from '../plan/task-handoff.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pluginDir = join(root, 'plugins', 'dsh-lan-assist')
const DENY = '预览已出，请到计划页确认并过账；不要代点。'

test('biz handoff prompt stops after confirm and forbids acting as the click', () => {
  const built = taskHandoffPrompt({
    id: 'task_one',
    title: '改等级',
    sourceRef: 'biz:客户:C-1',
  })
  assert.match(built.prompt, /请到计划页确认并过账/)
  assert.match(built.prompt, /next=confirm/)
  assert.match(built.prompt, /fde_plan_task_propose/)
  assert.match(built.prompt, /fde_submit_result/)
  assert.match(built.prompt, /然后停止/)
  assert.match(built.prompt, /禁止再调任何工具/)
  assert.match(built.prompt, /playwright/)
  assert.match(built.prompt, /chrome-devtools/)
  assert.match(built.prompt, /cua-driver/)
  assert.match(built.prompt, /不要代点/)
  assert.match(built.prompt, /确认只由人点计划卡/)
})

test('biz tool copy names the workstation confirm surface and forbids a chat click', () => {
  const tools = readFileSync(join(pluginDir, 'tools.js'), 'utf8')
  assert.equal(tools.includes('确认面由工作台指定（计划页或业务页）'), true)
  assert.equal(tools.includes('不要代点'), true)
  assert.equal(tools.includes('过账只在右侧'), false)
  const letter = briefFollowup({
    quote: '把等级改成 A',
    catalog: [{ name: 'biz_preview' }],
  })
  assert.match(letter, /确认面由工作台指定（计划页或业务页）/)
  assert.match(letter, /不要代点/)
  assert.equal(letter.includes('写才 biz_write'), false)
  assert.match(letter, /人到右边业务页看表/)
})

test('mint rewrites plan-page speech even when the round never contained the hint', async () => {
  const { speechForPlanHandoffMint, PLAN_PAGE_HINT } = await import('../plugins/dsh-lan-assist/handoff-mints.js')
  const result = {
    speak: '已生成预览 请在右侧确认过账',
    hint: '请在右侧确认过账',
    sheet: { speak: '请在右侧确认过账', hint: '请在右侧确认' },
  }
  const next = speechForPlanHandoffMint(result, {
    type: 'mint',
    sessionId: 'sess_mint',
    previewId: 'pv_01234567',
  })
  assert.equal(next.speak, `已生成预览\n${PLAN_PAGE_HINT}`)
  assert.equal(next.hint, PLAN_PAGE_HINT)
  assert.equal(next.sheet.speak, PLAN_PAGE_HINT)
  assert.equal(next.sheet.hint, PLAN_PAGE_HINT)
  assert.equal(result.speak.includes('请在右侧确认'), true)
  assert.equal(speechForPlanHandoffMint(result, null), result)
})

test('after confirm, playwright and search_text are refused and propose and submit still run', async () => {
  const { handoffConfirmToolDeny } = await import('../plugins/dsh-lan-assist/handoff-mints.js')
  const armed = { runningRun: true, mintMarked: true, nextConfirm: true }
  assert.equal(handoffConfirmToolDeny(armed, 'fde_mcp_load'), DENY)
  assert.equal(handoffConfirmToolDeny(armed, 'search_text'), DENY)
  assert.equal(handoffConfirmToolDeny(armed, 'mcp__playwright__browser_click'), DENY)
  assert.equal(handoffConfirmToolDeny(armed, 'mcp__chrome-devtools__click'), DENY)
  assert.equal(handoffConfirmToolDeny(armed, 'mcp__cua-driver__click'), DENY)
  assert.equal(handoffConfirmToolDeny(armed, 'fde_plan_task_propose'), '')
  assert.equal(handoffConfirmToolDeny(armed, 'fde_submit_result'), '')
  assert.equal(handoffConfirmToolDeny({ runningRun: true, nextConfirm: true }, 'search_text'), DENY)
  assert.equal(handoffConfirmToolDeny({ mintMarked: true }, 'playwright'), DENY)
  assert.equal(handoffConfirmToolDeny({ runningRun: true }, 'search_text'), '')
  assert.equal(handoffConfirmToolDeny({ nextConfirm: true }, 'fde_mcp_load'), '')
  assert.equal(handoffConfirmToolDeny({}, 'search_text'), '')
})

test('the confirm window closes when the next human line arrives', async () => {
  const {
    armHandoffConfirmWindow,
    clearHandoffConfirmWindow,
    handoffConfirmWindowActive,
  } = await import('../plugins/dsh-lan-assist/handoff-mints.js')
  clearHandoffConfirmWindow('sess_window')
  assert.equal(handoffConfirmWindowActive('sess_window'), false)
  armHandoffConfirmWindow('sess_window')
  assert.equal(handoffConfirmWindowActive('sess_window'), true)
  armHandoffConfirmWindow('')
  assert.equal(handoffConfirmWindowActive(''), false)
  clearHandoffConfirmWindow('sess_window')
  assert.equal(handoffConfirmWindowActive('sess_window'), false)
})

test('the mint path arms the confirm window and no longer gates the rewrite on the hint', () => {
  const index = readFileSync(join(pluginDir, 'index.js'), 'utf8')
  assert.equal(index.includes('speechForPlanHandoffMint(result, handoffEvent)'), true)
  assert.equal(index.includes('armHandoffConfirmWindow(handoffEvent.sessionId)'), true)
  assert.equal(index.includes('handoffConfirmToolDeny('), true)
  assert.equal(index.includes('clearHandoffConfirmWindow(sessionId)'), true)
  assert.equal(index.includes('handoffRoundAsksPlanPage('), false)
  const tools = readFileSync(join(pluginDir, 'tools.js'), 'utf8')
  const execute = tools.slice(tools.indexOf("name: 'biz_preview'"), tools.indexOf("name: 'biz_write'"))
  assert.equal(execute.includes('armHandoffConfirmWindow(sessionId)'), true)
})
