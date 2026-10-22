import { execFileSync } from 'node:child_process'
import { chmodSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { computeRuntimeTreeSync, runtimeKey } from '../runtime-bundle.js'
import { PLUGIN_VERSION } from '../version.js'
import { resolveNpmInvocation } from './resolve-npm.js'

const key = process.argv[2] || runtimeKey()
if (key !== runtimeKey()) throw new Error(`release media must be assembled on its native target: ${key}`)
const runtime = join(process.cwd(), 'runtime-dist', key)
const output = join(process.cwd(), 'release-dist', `dsh-semantic-os-${PLUGIN_VERSION}-${key}`)
rmSync(output, { recursive: true, force: true })
mkdirSync(join(output, 'scripts'), { recursive: true })
const npmCache = join(process.cwd(), 'runtime-dist', '.npm-cache')
const npm = resolveNpmInvocation()
const packed = JSON.parse(execFileSync(npm.command, [...npm.prefix, 'pack', '--json', '--pack-destination', output], {
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: npmCache },
  shell: Boolean(npm.shell),
}))
const pluginArchive = packed[0] && packed[0].filename
if (!pluginArchive) throw new Error('main plugin npm pack failed')
const destRuntime = join(output, 'runtime')
cpSync(runtime, destRuntime, { recursive: true, dereference: false })
const manifestPath = join(destRuntime, 'runtime-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const tree = computeRuntimeTreeSync(destRuntime)
manifest.fileCount = tree.fileCount
manifest.treeHash = tree.treeHash
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
for (const file of ['runtime-install.js', 'runtime-bundle.js', 'version.js']) cpSync(join(process.cwd(), file), join(output, file))
cpSync(join(process.cwd(), 'scripts', 'install-release.js'), join(output, 'scripts', 'install-release.js'))
  cpSync(join(process.cwd(), 'scripts', 'resolve-windows-tools.js'), join(output, 'scripts', 'resolve-windows-tools.js'))
for (const launcher of ['Install Semantic OS.command', 'Install Semantic OS.cmd', 'install-semantic-os.sh']) {
  cpSync(join(process.cwd(), 'scripts', 'launchers', launcher), join(output, launcher))
}
chmodSync(join(output, 'Install Semantic OS.command'), 0o755)
chmodSync(join(output, 'install-semantic-os.sh'), 0o755)
writeFileSync(join(output, 'package.json'), `${JSON.stringify({ type: 'module', private: true }, null, 2)}\n`)
writeFileSync(join(output, 'release-manifest.json'), `${JSON.stringify({ schemaVersion: 1, pluginVersion: PLUGIN_VERSION, runtimeKey: key, runtimeDirectory: 'runtime', pluginArchive: basename(pluginArchive) }, null, 2)}\n`)
console.log(output)
