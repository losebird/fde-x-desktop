import { resolve } from 'node:path'
import { runParentDeath } from '../../runtime/tests/support/parent-death-repro.mjs'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const out = outFlag >= 0 ? resolve(args[outFlag + 1] || '') : ''
const report = await runParentDeath({ mode: 'death', deadlineMs: 2000, out: out || undefined })
console.error(`verdict=${report.verdict} elapsedMs=${report.elapsedMs} samples=${report.samples?.length ?? 0} connector=${report.connector}`)
if (!out) console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
