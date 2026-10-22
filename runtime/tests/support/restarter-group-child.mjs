import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const pidfile = process.env.FDE_RESTARTER_CHILD_PIDFILE
if (pidfile) {
  const child = spawn('sleep', ['120'], { stdio: 'ignore' })
  writeFileSync(pidfile, `${child.pid}\n`)
}
