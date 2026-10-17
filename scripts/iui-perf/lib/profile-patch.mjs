import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export async function applyProfilePatch(home, profileNames = ['fde-x', 'web']) {
  const source = process.env.IUI_PERF_PROFILE_PATCH
  if (!source) return { applied: false, profiles: [] }
  const bytes = await readFile(source)
  const profiles = []
  for (const name of profileNames) {
    const dest = join(home, 'profiles', name, 'cordis.patch.yml')
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, bytes, { mode: 0o600 })
    profiles.push(name)
  }
  return { applied: true, profiles }
}
