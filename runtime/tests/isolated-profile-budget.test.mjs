import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IUI_PIN } from '../iui-pin.mjs'

// Noise-resistant budget. One process alternates the #59 vendor install
// (2f4719dd) and this checkout. Each pair uses two fresh homes for the cold
// call, then calls ensureIsolatedProfile again on those same homes for warm.
// The assertion is the median of head/base ratios, not a millisecond cutoff.
const BASE_SHA = '2f4719ddd999e9ed77f876157793017401710233'
const SAMPLES = 11
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[(sorted.length - 1) >> 1]
}

function baseCheckout() {
  const dest = join(tmpdir(), 'fde-pr4-base-2f4719dd')
  const core = join(dest, 'runtime', 'dsh-core.mjs')
  const marker = join(dest, '.base-sha')
  if (existsSync(core) && existsSync(marker) && existsSync(join(dest, 'runtime', 'vendor-overlays', 'dsh-lan-assist'))) {
    return dest
  }
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  const tar = join(tmpdir(), 'fde-pr4-base-2f4719dd.tar')
  execFileSync('git', ['archive', '--format=tar', '-o', tar, BASE_SHA, 'runtime', ':!runtime/data'], {
    cwd: repoRoot,
  })
  execFileSync('tar', ['-xf', tar, '-C', dest])
  writeFileSync(marker, `${BASE_SHA}\n`)
  return dest
}

test('ensureIsolatedProfile stays within twice the #59 path', { timeout: 180_000 }, async () => {
  const vendor = join(homedir(), '.dsh', 'vendor')
  assert.equal(existsSync(join(vendor, 'dsh-lan-assist')), true)
  assert.equal(existsSync(join(vendor, 'dsh-semantic-os')), true)
  const emptyVendor = mkdtempSync(join(tmpdir(), 'fde-budget-vendor-'))
  const iui = mkdtempSync(join(tmpdir(), 'fde-budget-iui-'))
  writeFileSync(join(iui, 'package.json'), `${JSON.stringify({ name: '@losebird/iui', version: IUI_PIN.version })}\n`)
  writeFileSync(join(iui, 'fde-plugin-pin.json'), `${JSON.stringify({ commit: IUI_PIN.commit })}\n`)
  const saved = {
    FDE_VENDOR_DIR: process.env.FDE_VENDOR_DIR,
    FDE_PLUGIN_IUI: process.env.FDE_PLUGIN_IUI,
    FDE_PLUGIN_DSH_LAN_ASSIST: process.env.FDE_PLUGIN_DSH_LAN_ASSIST,
    FDE_PLUGIN_DSH_SEMANTIC_OS: process.env.FDE_PLUGIN_DSH_SEMANTIC_OS,
    FDE_IUI_ARTIFACT: process.env.FDE_IUI_ARTIFACT,
    FDE_REFRESH_PLUGINS: process.env.FDE_REFRESH_PLUGINS,
  }
  delete process.env.FDE_PLUGIN_DSH_LAN_ASSIST
  delete process.env.FDE_PLUGIN_DSH_SEMANTIC_OS
  delete process.env.FDE_IUI_ARTIFACT
  delete process.env.FDE_REFRESH_PLUGINS
  process.env.FDE_PLUGIN_IUI = iui
  process.env.FDE_VENDOR_DIR = vendor
  const base = await import(pathToFileURL(join(baseCheckout(), 'runtime', 'dsh-core.mjs')).href)
  process.env.FDE_VENDOR_DIR = emptyVendor
  const head = await import(pathToFileURL(join(repoRoot, 'runtime', 'dsh-core.mjs')).href)
  const coldRatios = []
  const warmRatios = []
  try {
    for (let i = 0; i < SAMPLES; i += 1) {
      const baseHome = await mkdtemp(join(tmpdir(), 'fde-budget-base-'))
      const headHome = await mkdtemp(join(tmpdir(), 'fde-budget-head-'))
      const cold = []
      const warm = []
      const run = async (mod, home, bucket) => {
        const connector = new mod.DshCoreConnector({ dshHome: home, cwd: home })
        const started = performance.now()
        await connector.ensureIsolatedProfile()
        const ms = performance.now() - started
        assert.equal(connector.state, 'idle', connector.lastError)
        assert.equal(connector.lastError, null)
        bucket.push(ms)
      }
      const order = i % 2 === 0
        ? [[base, baseHome], [head, headHome]]
        : [[head, headHome], [base, baseHome]]
      for (const [mod, home] of order) await run(mod, home, cold)
      for (const [mod, home] of order) await run(mod, home, warm)
      const baseCold = i % 2 === 0 ? cold[0] : cold[1]
      const headCold = i % 2 === 0 ? cold[1] : cold[0]
      const baseWarm = i % 2 === 0 ? warm[0] : warm[1]
      const headWarm = i % 2 === 0 ? warm[1] : warm[0]
      coldRatios.push(headCold / baseCold)
      warmRatios.push(headWarm / baseWarm)
      await rm(baseHome, { recursive: true, force: true })
      await rm(headHome, { recursive: true, force: true })
    }
    const coldMedian = median(coldRatios)
    const warmMedian = median(warmRatios)
    console.log(`cold median ratio ${coldMedian.toFixed(3)} warm median ratio ${warmMedian.toFixed(3)} n=${SAMPLES}`)
    assert.ok(coldMedian <= 2, `cold median ratio ${coldMedian.toFixed(3)} exceeds 2`)
    assert.ok(warmMedian <= 2, `warm median ratio ${warmMedian.toFixed(3)} exceeds 2`)
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    rmSync(emptyVendor, { recursive: true, force: true })
    rmSync(iui, { recursive: true, force: true })
  }
})
