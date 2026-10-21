import { resolve } from 'node:path'
import { runHostExitStatus } from '../../runtime/tests/support/host-exit-status-repro.mjs'

const args = process.argv.slice(2)
const modeFlag = args.indexOf('--mode')
const mode = modeFlag >= 0 ? args[modeFlag + 1] : ''
const outFlag = args.indexOf('--out')
const out = outFlag >= 0 ? resolve(args[outFlag + 1] || '') : ''
const report = await runHostExitStatus({ mode, out: out || undefined })
console.error(`mode=${report.mode} ok=${report.ok} inGroup=${report.inGroup} elapsedMs=${report.elapsedMs} pip=${report.pipBefore?.pid ?? ''}/${report.pipBefore?.pgid ?? ''} leaderPgid=${report.leaderPgid} message=${JSON.stringify(report.message)} error=${report.error ?? ''}`)
if (!out) console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
