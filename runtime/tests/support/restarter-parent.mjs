import { writeFileSync } from 'node:fs'
import { releaseRuntimeRestarter, spawnRuntimeRestarter } from '../../../scripts/runtime-respawn.mjs'

const mode = process.argv[2]
const metaPath = process.argv[3]
const childPidPath = process.argv[4]
const preload = process.argv[5] || ''

const env = { ...process.env }
delete env.FDE_DSH_HOME
delete env.FDE_IUI_ARTIFACT
if (preload) {
  env.NODE_OPTIONS = `--import ${preload}`
  env.FDE_RESTARTER_CHILD_PIDFILE = childPidPath
}

const restarter = spawnRuntimeRestarter({
  cwd: process.cwd(),
  env,
  pid: process.pid,
})

writeFileSync(metaPath, JSON.stringify({
  parent: process.pid,
  restarter: restarter.pid,
}))

if (mode === 'restart') {
  const stdin = restarter.stdin
  if (stdin && stdin.writable) {
    stdin.write('go\n', () => process.exit(0))
  } else {
    releaseRuntimeRestarter(restarter)
    process.exit(0)
  }
} else {
  setInterval(() => {}, 1000)
}
