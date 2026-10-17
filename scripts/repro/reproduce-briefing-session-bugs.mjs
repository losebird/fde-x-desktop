import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { join } from 'node:path'
import * as zlib from 'node:zlib'

if (typeof zlib.zstdDecompress !== 'function') {
  console.error('这套复现要带 node:zlib zstdDecompress 的 Node。本机可用 22.23.3。')
  process.exit(1)
}

const { removeFixtureRoot, runProjectionBriefing } = await import('./lib/briefing-fixture.mjs')

const execFileAsync = promisify(execFile)
const repoRoot = join(import.meta.dirname, '..', '..')
const outDir = join(repoRoot, 'artifacts', 'briefing-session-bugs')

function git(args) {
  return execFileAsync('git', args, { cwd: repoRoot }).then((result) => result.stdout)
}

async function ancestry() {
  const commits = [
    'c0227143951200e1c6e346dd63cdf2b05c936ee2',
    'b0cbb6b26',
    'bdacd5ada',
    'a8449148',
    '3efbf12be',
  ]
  const rows = []
  for (const rev of commits) {
    let resolved = ''
    let onMain = false
    let subject = ''
    try {
      resolved = (await git(['rev-parse', rev])).trim()
      subject = (await git(['log', '-1', '--format=%H%n%ci%n%s', resolved])).trim()
      try {
        await execFileAsync('git', ['merge-base', '--is-ancestor', resolved, 'origin/main'], { cwd: repoRoot })
        onMain = true
      } catch {
        onMain = false
      }
    } catch (error) {
      subject = error instanceof Error ? error.message : String(error)
    }
    rows.push({ rev, resolved, onMain, subject })
  }
  const showMain = await git(['grep', '-n', 'resolveBriefingSession\\|resolvePrimarySessionForRuntime', 'origin/main', '--', 'runtime/briefing/run.mjs']).catch((error) => error.stdout || error.message)
  const blame = []
  for (const spec of [
    ['runtime/briefing/ask-ai.mjs', '61,63'],
    ['runtime/briefing/session.mjs', '33,35'],
    ['runtime/briefing/run.mjs', '143,144'],
    ['src/pages/AI.tsx', '137,145'],
    ['src/pages/AI.tsx', '569,579'],
    ['src/pages/AI.tsx', '492,492'],
    ['runtime/server.mjs', '1993,1998'],
  ]) {
    const text = await git(['blame', '-L', spec[1], '--', spec[0]])
    blame.push({ file: spec[0], lines: spec[1], text })
  }
  return { head: (await git(['rev-parse', 'HEAD'])).trim(), rows, showMain, blame }
}

const observed = await runProjectionBriefing()
const reproduced = observed.mail.error.includes('会话未投影 mcp__mail__imap_search')
  && observed.news.error.includes('会话未投影 mcp__ai-hot__aihot_get_latest')
  && observed.mail.items === 0
  && observed.news.items === 0
  && observed.promptCalled === false
  && observed.sessionCreate?.agentPreset === 'fde-briefing'
  && observed.events.includes('briefing.ready')
  && !observed.events.includes('ai.session.changed')
  && observed.projectedBeforePrompt.length === 0
  && observed.spoken.every((row) => row.callText.startsWith('fake-'))

const record = {
  reproduced,
  head: '',
  mail: observed.mail,
  news: observed.news,
  promptCalled: observed.promptCalled,
  events: observed.events,
  sessionCreate: observed.sessionCreate,
  projectedBeforePrompt: observed.projectedBeforePrompt,
  spoken: observed.spoken,
  patchEntries: observed.patchEntries,
  status: observed.status,
}
await removeFixtureRoot(observed.root)

await mkdir(outDir, { recursive: true })
let history = {}
try {
  history = await ancestry()
  record.head = history.head
} catch (error) {
  history = { error: error instanceof Error ? error.stack : String(error) }
}
await writeFile(join(outDir, 'bug1-inprocess.json'), `${JSON.stringify(record, null, 2)}\n`)
await writeFile(join(outDir, 'ancestry.txt'), `${JSON.stringify(history, null, 2)}\n`)

const desired = await execFileAsync(process.execPath, ['--test', join(repoRoot, 'scripts/repro/briefing-session-desired.test.mjs')], {
  cwd: repoRoot,
}).then((result) => ({ code: 0, stdout: result.stdout, stderr: result.stderr })).catch((error) => ({
  code: error.code ?? 1,
  stdout: error.stdout || '',
  stderr: error.stderr || error.message,
}))
await writeFile(join(outDir, 'desired-behavior-red.txt'), `${desired.stdout}\n${desired.stderr}\nexit ${desired.code}\n`)

if (!reproduced) {
  console.error('in-process bug was not reproduced')
  console.error(JSON.stringify(record, null, 2))
  process.exit(1)
}
if (desired.code === 0) {
  console.error('desired-behavior test passed, so the bug is gone')
  process.exit(1)
}
console.log(`reproduced bug1 and missing ai.session.changed; desired test exit ${desired.code}`)
