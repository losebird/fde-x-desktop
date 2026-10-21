import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { resolveInstalledRuntime } from '../runtime-install.js'
import { runtimeKey } from '../runtime-bundle.js'
import { PLUGIN_VERSION } from '../version.js'

const media = process.argv[2]
if (!media) throw new Error('usage: verify-release-media.js MEDIA_ROOT')
const temp = mkdtempSync(join(tmpdir(), 'dsos-release-media-'))
const home = join(temp, 'home')
const bin = join(temp, 'bin')
mkdirSync(bin, { recursive: true })
const log = join(temp, 'dsh-call.json')
let executable
if (process.platform === 'win32') {
    const stub = join(bin, 'dsh-stub.js')
    writeFileSync(stub, `require('fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)))\n`)
    executable = join(bin, 'dsh.cmd')
    writeFileSync(executable, `@echo off\r\n"${process.execPath}" "${stub}" %*\r\n`)
  } else {
  executable = join(bin, 'dsh')
  writeFileSync(executable, `#!/bin/sh\nprintf '["%s","%s","%s","%s","%s"]\\n' "$1" "$2" "$3" "$4" "$5" > '${log}'\n`)
  chmodSync(executable, 0o755)
}
try {
  const env = { ...process.env, DSH_HOME: home, DSH_EXECUTABLE: executable, DSH_SKIP_PNPM_CHECK: '1' }
  process.env.DSH_HOME = home
  execFileSync(process.execPath, [join(media, 'scripts', 'install-release.js'), media], { stdio: 'inherit', env })
  const runtime = await resolveInstalledRuntime({ verifyFiles: true })
  if (!runtime.ok) throw new Error(`installed runtime invalid: ${runtime.error}`)
  execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'runtime-sidecar-smoke.js'), runtime.python], { stdio: 'inherit', env })
  const call = JSON.parse(readFileSync(log, 'utf8'))
  if (call[0] !== 'plugin' || call[1] !== '--profile' || call[2] !== 'web' || call[3] !== 'add') throw new Error(`unexpected dsh call: ${JSON.stringify(call)}`)
  console.log(`release media verified: ${PLUGIN_VERSION}/${runtimeKey()}`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
