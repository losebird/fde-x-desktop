import { waitForLine } from './drive.mjs'

const logs = {
  text() {
    return { stdout: '', stderr: '' }
  },
  raw() {
    return { stdout: '', stderr: '' }
  },
}

waitForLine(logs, /settings: imported/, 40).catch(() => {})
