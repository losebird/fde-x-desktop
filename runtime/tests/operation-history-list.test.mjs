import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const libPath = join(repoRoot, 'src/lib/biz-operation-history.ts')
const panelPath = join(repoRoot, 'src/components/biz/OperationRecordPanel.tsx')

async function importHistory() {
  const source = readFileSync(libPath, 'utf8').replace(/import type[^\n]+\n/, '')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
    fileName: 'biz-operation-history.ts',
  })
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`)
}

test('§11 operation history page size search and tones', async () => {
  const lib = await importHistory()
  assert.equal(lib.HISTORY_PAGE_SIZE, 20)

  const tokens = lib.collectActionTokens(['改行', '回退', '现查', '改行'])
  assert.equal(tokens.length, 3)
  assert.notEqual(lib.actionTone('改行', tokens), lib.actionTone('回退', tokens))
  assert.notEqual(lib.actionTone('现查', tokens), lib.actionTone('改行', tokens))

  const rows = Array.from({ length: 45 }, (_, i) => ({ id: String(i + 1) }))
  const page2 = lib.paginateHistory(rows, 2)
  assert.equal(page2.page, 2)
  assert.equal(page2.totalPages, 3)
  assert.equal(page2.rows.length, 20)
  assert.equal(page2.rows[0].id, '21')
  assert.equal(lib.paginateHistory(rows, 2).page, 2)

  const hay = lib.historySearchHaystack(['对象甲', '改行', 'NO-88', '字段：旧→新'])
  assert.equal(lib.historyRowMatches(hay, 'NO-88'), true)
  assert.equal(lib.historyRowMatches(hay, '改行'), true)
  assert.equal(lib.historyRowMatches(hay, '旧→新'), true)
  assert.equal(lib.historyRowMatches(hay, '对象乙'), false)

  const done = lib.historyRecordStatus('回退', 'none')
  const rolled = lib.historyRecordStatus('改行', 'rolled_back')
  const can = lib.historyRecordStatus('改行', 'can')
  assert.equal(done.label, '已完成')
  assert.equal(rolled.label, '已回退')
  assert.equal(can.label, '可回退')
  assert.notEqual(done.kind, rolled.kind)
  assert.notEqual(rolled.kind, can.kind)

  const panel = readFileSync(panelPath, 'utf8')
  assert.match(panel, /HISTORY_PAGE_SIZE/)
  assert.match(panel, /placeholder="对象、动作、单号、变更摘要"/)
  const refreshBlock = panel.slice(panel.indexOf('const refresh'), panel.indexOf('}, [runtimeReady]'))
  assert.doesNotMatch(refreshBlock, /setPage\(1\)/)
  assert.doesNotMatch(panel, /处理中/)
  assert.doesNotMatch(readFileSync(libPath, 'utf8'), /处理中/)
})
