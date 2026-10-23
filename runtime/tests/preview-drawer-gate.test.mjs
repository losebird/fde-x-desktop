import './support/no-stray-processes.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(fileURLToPath(new URL('..', import.meta.url)), '..')
const src = readFileSync(join(repoRoot, 'src/components/biz/RecordsPanel.tsx'), 'utf8')

test('empty connector and empty table returns mount the same confirm drawer', () => {
  assert.equal(src.split('<BizPreviewDrawer').length - 1, 1)
  const assignAt = src.indexOf('const previewDrawer')
  const emptyConnectorsAt = src.indexOf('if (!connectorOptions.length)')
  const noRowsAt = src.indexOf('if (!hasSurfacedData)')
  assert.ok(assignAt >= 0 && assignAt < emptyConnectorsAt, 'previewDrawer is built before the empty-connector return')
  const assignBlock = src.slice(assignAt, emptyConnectorsAt)
  assert.match(assignBlock, /<BizPreviewDrawer/)
  assert.match(assignBlock, /onConfirm=\{\(\) => void confirmWrite\(\)\}/)
  assert.match(assignBlock, /onClose=\{dismissPreviewDrawer\}/)
  assert.match(assignBlock, /: null/)

  const emptyConnectors = src.slice(emptyConnectorsAt, noRowsAt)
  const mountedInEmpty = emptyConnectors.indexOf('{previewDrawer}')
  const bareEmpty = emptyConnectors.indexOf('return <Empty title="先在设置登记业务连接器"')
  assert.ok(mountedInEmpty >= 0 && bareEmpty > mountedInEmpty, 'a live drawer sits above the no-connector empty state')
  assert.match(emptyConnectors, /先在设置登记业务连接器/)

  const mainAt = src.indexOf('\n  return (', noRowsAt)
  const noRows = src.slice(noRowsAt, mainAt)
  const mountedInNoRows = noRows.indexOf('{previewDrawer}')
  const noRowsTitle = noRows.indexOf('还没有 AI 查过或改过的业务记录')
  assert.ok(mountedInNoRows >= 0 && noRowsTitle > mountedInNoRows, 'a live drawer sits above the no-rows empty state')

  const main = src.slice(mainAt)
  assert.match(main, /\{previewDrawer\}/)
  assert.equal(main.includes('<BizPreviewDrawer'), false)

  assert.match(src, /const connectorOptions = useMemo\(\s*\(\) => connections\.map\(\(c\) => \(\{ id: c\.id, label: c\.name \}\)\)/)
  assert.match(src, /const PENDING_HYDRATE_MS = 2000/)
  const pendingHook = src.slice(src.indexOf("useEvents(['biz.sheet.pending']"), src.indexOf("useEvents(['biz.sheet.pending']") + 120)
  assert.equal(pendingHook.includes('workspace'), false)

  const confirm = src.slice(src.indexOf('const confirmWrite'), src.indexOf('const askAiForRow'))
  const dirtyAt = confirm.indexOf('if (dirty)')
  assert.ok(dirtyAt > 0)
  assert.equal(confirm.slice(0, dirtyAt).includes('connections'), false)
  assert.ok(confirm.indexOf('runtimeApi.bizWrite') > dirtyAt)
  assert.ok(confirm.indexOf('connections.find') > dirtyAt)
})
