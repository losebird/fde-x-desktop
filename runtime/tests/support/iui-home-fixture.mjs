import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const FAKE_CREDENTIALS = 'version: 1\nrefs: {}\n'

export async function writeFakeDshCredentials(home) {
  await writeFile(join(home, '.credentials.yaml'), FAKE_CREDENTIALS, { mode: 0o600 })
}

export function goodIuiTar(commit) {
  const name = `iui-${commit}.tar.gz`
  const candidates = [
    process.env.FDE_IUI_GOOD_TAR || '',
    join(homedir(), '.dsh', 'iui', name),
    join(homedir(), '.dsh', 'vendor', 'iui', name),
  ].filter(Boolean)
  const found = candidates.find((path) => existsSync(path))
  if (!found) throw new Error(`good IUI tar missing: ${candidates.join(', ')}`)
  return found
}
