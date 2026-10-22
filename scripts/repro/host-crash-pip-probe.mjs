import { resolve } from 'node:path'
import { runParentDeath } from '../../runtime/tests/support/parent-death-repro.mjs'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const out = outFlag >= 0 ? resolve(args[outFlag + 1] || '') : ''
const report = await runParentDeath({ mode: 'crash', deadlineMs: 2000, out: out || undefined })
const pip = (report.pipBefore || []).map((row) => `${row.pid}/${row.pgid}`).join(',')
console.error(`verdict=${report.verdict} ok=${report.ok} inGroup=${report.crashJudgment?.inGroup} elapsedMs=${report.elapsedMs} transientPid1=${report.transientPid1?.length ?? 0} pip=${pip} leaderPgid=${report.leaderPgid} error=${report.error ?? ''}`)
if (!out) console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
