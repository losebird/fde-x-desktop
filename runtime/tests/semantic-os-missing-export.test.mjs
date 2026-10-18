import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { draftCard } from '../memory/draft.mjs'
import { missingExportName, pluginImportDetail, probeFailedReady } from '../memory/missing-export.mjs'

test('missing export text is the Node message', () => {
  const message = "The requested module './session-ingest.js' does not provide an export named 'adaptSessionPersistence'"
  assert.equal(missingExportName(message), 'adaptSessionPersistence')
  assert.equal(pluginImportDetail('adaptSessionPersistence'), '插件导入失败，缺少导出 adaptSessionPersistence')
})

test('probe failure names the export dsh omitted from failed-to-import', async () => {
  const home = await mkdtemp(join(tmpdir(), 'fde-m1-export-'))
  const plugin = join(home, 'vendor', 'dsh-semantic-os')
  await mkdir(plugin, { recursive: true })
  await writeFile(join(plugin, 'session-ingest.js'), 'export const present = 1\n')
  await writeFile(join(plugin, 'index.js'), "export { adaptSessionPersistence } from './session-ingest.js'\n")
  const aiRuntime = {
    dshHome: home,
    status: () => ({
      connected: false,
      recentLogs: ['dsh: warning: 1 entry did not activate', 'dsh-semantic-os (dsh-semantic-os): failed to import'],
    }),
  }
  try {
    const ready = await probeFailedReady(aiRuntime)
    assert.equal(ready.probe, 'failed')
    assert.equal(ready.missingExport, 'adaptSessionPersistence')
    assert.equal(ready.detail, '插件导入失败，缺少导出 adaptSessionPersistence')
    const drafted = await draftCard({ db: null, aiRuntime }, {
      cwd: '/tmp/ws',
      origin: 'session:s1',
      label: '12345678 一句足够长的正文',
      auto: true,
    })
    assert.deepEqual(drafted, {
      ok: false,
      error: 'ai/memory-error',
      missingExport: 'adaptSessionPersistence',
      message: '插件导入失败，缺少导出 adaptSessionPersistence',
    })
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('an ordinary outage stays semantic_down', async () => {
  const aiRuntime = {
    status: () => ({ connected: false, recentLogs: ['core stopped'] }),
  }
  assert.deepEqual(await probeFailedReady(aiRuntime), { probe: 'failed' })
  const drafted = await draftCard({ db: null, aiRuntime }, {
    cwd: '/tmp/ws',
    origin: 'session:s1',
    label: '12345678 一句足够长的正文',
    auto: true,
  })
  assert.equal(drafted.skipped, true)
  assert.equal(drafted.reason, 'semantic_down')
})

test('memory page status names the missing export', async () => {
  const page = await readFile(join(import.meta.dirname, '../../src/pages/Memory.tsx'), 'utf8')
  assert.match(page, /function memoryEngineStatus/)
  assert.match(page, /插件导入失败，缺少导出 \$\{name\}/)
  assert.match(page, /memoryEngineStatus\(ready, online\)/)
  assert.match(page, /插件导入失败，缺少导出 \$\{ready\.missingExport\.trim\(\)\}/)
  assert.match(page, /引擎未就绪/)
})
