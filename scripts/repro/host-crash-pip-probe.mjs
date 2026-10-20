import { resolve } from 'node:path'
import { runParentDeath } from '../../runtime/tests/support/parent-death-repro.mjs'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const out = outFlag >= 0 ? resolve(args[outFlag + 1] || '') : ''
const report = await runParentDeath({ mode: 'crash', deadlineMs: 2000, out: out || undefined })
console.error(`verdict=${report.verdict} mode=${report.mode} reparented=${report.reparented?.length ?? 0} killedPid=${report.killed?.pid ?? ''} killedRole=${report.killed?.role ?? ''} parentAliveAfter=${report.parentAliveAfter} error=${report.error ?? ''}`)
if (!out) console.log(JSON.stringify(report, null, 2))
process.exit(report.error ? 1 : 0)
