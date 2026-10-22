import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.env.FDE_RESTARTER_RUNTIME_PIDDIR
const entry = process.argv[1] || ''
if (dir && /(?:^|\/)runtime\/(?:boot|server)\.mjs$/.test(entry)) {
  writeFileSync(join(dir, `runtime-${process.pid}.pid`), `${process.pid}\n`)
}
