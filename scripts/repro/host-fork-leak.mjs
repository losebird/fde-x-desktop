import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { runForkTrial } from '../../runtime/tests/support/host-fork-repro.mjs'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const out = outFlag >= 0 ? resolve(args[outFlag + 1] || '') : ''
const report = await runForkTrial()
console.error(`ok=${report.ok} leaked=${report.leakedCount} elapsedMs=${report.elapsedMs} leaderExit=${report.status?.signal || report.status?.code}`)
if (out) {
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`)
} else {
  console.log(JSON.stringify(report, null, 2))
}
process.exit(report.ok ? 0 : 1)
