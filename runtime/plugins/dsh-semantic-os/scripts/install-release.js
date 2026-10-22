import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installRuntimeFromDirectory } from '../runtime-install.js'
import { runtimeKey } from '../runtime-bundle.js'
import { PLUGIN_VERSION } from '../version.js'
import { resolveWindowsTool } from './resolve-windows-tools.js'

function mediaRootFromArg(value) {
  return resolve(String(value || '').replace(/["']+$/g, '').replace(/[\\/]+$/, '') || dirname(fileURLToPath(import.meta.url)))
}
const mediaRoot = mediaRootFromArg(process.argv[2])
const manifestPath = join(mediaRoot, 'release-manifest.json')
if (!existsSync(manifestPath)) throw new Error(`release manifest missing: ${manifestPath}`)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const key = runtimeKey()
if (manifest.schemaVersion !== 1 || manifest.pluginVersion !== PLUGIN_VERSION || manifest.runtimeKey !== key) {
  throw new Error(`release media does not match this machine: expected ${PLUGIN_VERSION}/${key}`)
}
const runtimeRoot = join(mediaRoot, manifest.runtimeDirectory || 'runtime')
const pluginArchive = join(mediaRoot, manifest.pluginArchive || `dsh-semantic-os-${PLUGIN_VERSION}.tgz`)
if (!existsSync(pluginArchive)) throw new Error(`plugin archive missing: ${pluginArchive}`)
const dsh = process.env.DSH_EXECUTABLE
  || (process.platform === 'win32' ? resolveWindowsTool(['dsh.cmd', 'dsh.exe']) : '')
  || 'dsh'
const pnpm = process.platform === 'win32' ? resolveWindowsTool(['pnpm.cmd', 'pnpm.exe', 'pnpm']) : ''
const profile = process.env.DSH_PROFILE || 'web'
function runDsh(args, options = {}) {
  const winCmd = process.platform === 'win32' && /\.(cmd|bat)$/i.test(dsh)
  return execFileSync(dsh, args, { ...options, shell: winCmd || Boolean(options.shell) })
}
function hasCommand(command) {
  const probe = process.platform === 'win32' ? ['where.exe', command] : ['sh', '-c', `command -v ${command}`]
  const result = spawnSync(probe[0], probe.slice(1), { stdio: 'ignore' })
  return result.status === 0
}
if (process.env.DSH_EXECUTABLE === undefined && dsh === 'dsh' && !hasCommand('dsh')) {
  throw new Error('DeepSeek Harness command `dsh` was not found. Install DSH, open it once, then run this installer again. On Windows the installer looks for dsh.cmd next to npm/pnpm.')
}
if (process.env.DSH_SKIP_PNPM_CHECK !== '1' && !pnpm && !hasCommand('pnpm')) {
  throw new Error('`pnpm` was not found. `dsh plugin add` needs pnpm; install pnpm first, then run this installer again.')
}
const installed = await installRuntimeFromDirectory(runtimeRoot, {
  activate() {
    try {
      // Remove first so pnpm re-installs even when the plugin version is unchanged;
      // a plain `add` of the same version is a no-op and would keep stale code.
      runDsh(['plugin', '--profile', profile, 'remove', 'dsh-semantic-os'], { stdio: 'ignore' })
    } catch { /* not installed yet */ }
    try {
      runDsh(['plugin', '--profile', profile, 'add', pluginArchive], { stdio: 'inherit' })
    } catch (error) {
      if (error && error.code === 'ENOENT') throw new Error(`DeepSeek Harness command not found: ${dsh}. Open DSH once, then run this installer again.`)
      throw error
    }
  },
})
if (!installed.ok) {
  const detail = [
    installed.error,
    installed.expectedFileCount != null ? `expectedFileCount=${installed.expectedFileCount}` : '',
    installed.actualFileCount != null ? `actualFileCount=${installed.actualFileCount}` : '',
    installed.expectedTreeHash ? `expectedTreeHash=${installed.expectedTreeHash}` : '',
    installed.actualTreeHash ? `actualTreeHash=${installed.actualTreeHash}` : '',
    installed.path ? `path=${installed.path}` : '',
  ].filter(Boolean).join(' ')
  throw new Error(`runtime verification failed: ${detail}`)
}
console.log(`Semantic OS ${PLUGIN_VERSION} installed for ${key}`)
