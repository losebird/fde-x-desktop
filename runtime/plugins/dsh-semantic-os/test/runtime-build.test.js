import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('runtime wheel resolution always uses the staged interpreter', async () => {
  const build = await readFile(new URL('../scripts/build-runtime-package.js', import.meta.url), 'utf8')
  const download = await readFile(new URL('../scripts/download-wheelhouse.js', import.meta.url), 'utf8')
  assert.ok(build.includes("download-wheelhouse.js'), python"))
  assert.ok(build.includes("execFileSync(python, ['-m', 'pip', 'install', '--break-system-packages'"))
  assert.ok(download.includes('execFileSync(python, args'))
  assert.ok(download.includes("'--no-binary=falkordblite'"))
  assert.ok(download.includes("https://download.pytorch.org/whl/cpu"))
  const constraints = await readFile(new URL('../runtime/constraints.txt', import.meta.url), 'utf8')
  assert.ok(constraints.includes('torch==2.13.0+cpu; sys_platform == "linux"'))
  assert.ok(download.includes("args.push('wheel')"))
  assert.ok(build.includes('resolve(process.env.DSH_RUNTIME_PYTHON)'))
  assert.equal(build.includes("execFileSync('python3', ['-m', 'pip'"), false)
})

test('public release may ship passed platforms without waiting for all five', async () => {
  const release = await readFile(new URL('../RELEASE.md', import.meta.url), 'utf8')
  assert.equal(release.includes('valid only when all five'), false)
  assert.match(release, /every platform whose CI job passed/)
  assert.match(release, /torch==2\.13\.0\+cpu/)
})

test('release CI media path uses PLUGIN_VERSION, not a hardcoded 0.1.0', async () => {
  const workflow = await readFile(new URL('../.github/workflows/runtime-packages.yml', import.meta.url), 'utf8')
  assert.equal(workflow.includes('dsh-semantic-os-0.1.0-'), false)
  assert.ok(workflow.includes('PLUGIN_VERSION'))
  assert.ok(workflow.includes('gh release upload'))
  assert.ok(workflow.includes('continue-on-error: true'))
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.ok(pkg.files.includes('opening-brief.js'))
  assert.ok(pkg.files.includes('extract-jobs.js'))
})

test('finalize scans Unix lib and Windows Lib without requiring python/lib', async () => {
  const source = await readFile(new URL('../scripts/finalize-runtime-package.js', import.meta.url), 'utf8')
  assert.ok(source.includes("['lib', 'Lib', 'libs']"))
  assert.ok(source.includes('pythonLibRoots'))
})

test('sidecar smoke resolves the staged interpreter to an absolute path', async () => {
  const source = await readFile(new URL('../scripts/runtime-sidecar-smoke.js', import.meta.url), 'utf8')
  assert.ok(source.includes('resolve(process.argv[2])'))
})

test('Windows archive uses relative tar paths so Git tar does not treat D: as a host', async () => {
  const source = await readFile(new URL('../scripts/archive-release-media.js', import.meta.url), 'utf8')
  assert.ok(source.includes("execFileSync('tar', ['-cf', tarName, name], { cwd: dist })"))
  assert.equal(source.includes("'-C'"), false)
})

test('Windows installer looks for dsh.cmd next to npm and copies the helper into media', async () => {
  const install = await readFile(new URL('../scripts/install-release.js', import.meta.url), 'utf8')
  const media = await readFile(new URL('../scripts/build-release-media.js', import.meta.url), 'utf8')
  const cmd = await readFile(new URL('../scripts/launchers/Install Semantic OS.cmd', import.meta.url), 'utf8')
  const deps = await readFile(new URL('../ensure-deps.js', import.meta.url), 'utf8')
  assert.ok(install.includes('resolveWindowsTool'))
  assert.ok(media.includes('resolve-windows-tools.js'))
  assert.ok(cmd.includes('%APPDATA%\\npm'))
  assert.ok(deps.includes("process.platform === 'win32'"))
  assert.ok(deps.indexOf('startWindowsWslLite') < deps.indexOf('} else if (runtime.ok)'))
})

test('Windows installer cmd does not quote a trailing backslash path', async () => {
  const source = await readFile(new URL('../scripts/launchers/Install Semantic OS.cmd', import.meta.url), 'utf8')
  assert.ok(source.includes('cd /d "%~dp0"'))
  assert.ok(source.includes('"%NODE%" "scripts\\install-release.js" "%CD%"'))
  assert.equal(source.includes('"%HERE%"'), false)
})

test('Windows installer runs .cmd dsh stubs through the shell', async () => {
  const source = await readFile(new URL('../scripts/install-release.js', import.meta.url), 'utf8')
  const verify = await readFile(new URL('../scripts/verify-release-media.js', import.meta.url), 'utf8')
  assert.ok(source.includes('function runDsh'))
  assert.ok(source.includes('shell: winCmd || Boolean(options.shell)'))
  assert.ok(verify.includes('dsh-stub.js'))
})

test('installer media copies the runtime without dereferencing links', async () => {
  const media = await readFile(new URL('../scripts/build-release-media.js', import.meta.url), 'utf8')
  const install = await readFile(new URL('../runtime-install.js', import.meta.url), 'utf8')
  assert.ok(media.includes('dereference: false'))
  assert.equal(media.includes('dereference: true'), false)
  assert.ok(install.includes('dereference: false'))
  assert.equal(install.includes('dereference: true'), false)
})

test('runtime publish removes the build-only wheelhouse before manifesting', async () => {
  const source = await readFile(new URL('../scripts/finalize-runtime-package.js', import.meta.url), 'utf8')
  const remove = source.indexOf("rmSync(wheelhouse, { recursive: true, force: true })")
  const manifest = source.indexOf("runtime-manifest.json")
  assert.ok(remove > 0 && manifest > remove)
  assert.ok(source.includes('schemaVersion: 2'))
})
