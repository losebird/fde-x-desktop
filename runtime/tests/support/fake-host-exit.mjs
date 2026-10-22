import { spawn } from 'node:child_process'
import { openSync, readSync, writeFileSync } from 'node:fs'

const readyPath = process.env.FAKE_HOST_READY || ''
const goPath = process.env.FAKE_HOST_GO || ''
const mode = process.env.FAKE_HOST_MODE || ''
if (!readyPath || !goPath || (mode !== 'code' && mode !== 'signal')) process.exit(2)

const pip = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'semantica', 'pip'], {
  stdio: 'ignore',
})
writeFileSync(readyPath, `${JSON.stringify({ hostPid: process.pid, pipPid: pip.pid })}\n`)

if (mode === 'signal') {
  setInterval(() => {}, 1000)
} else {
  const fd = openSync(goPath, 'r')
  const buf = Buffer.alloc(32)
  const n = readSync(fd, buf, 0, buf.length, null)
  const code = Number(buf.subarray(0, n).toString().trim())
  process.exit(Number.isInteger(code) ? code : 1)
}
