import { access, cp, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FDE_RUNTIME_DIR } from './config.mjs'

export async function seedBuiltinSkills(dshHome) {
  const home = String(dshHome || '').trim()
  if (!home) return []
  const destRoot = join(home, 'skills')
  const srcRoot = join(FDE_RUNTIME_DIR, 'builtin-skills')
  const seeded = []
  for (const name of ['find-skill', 'skillspector']) {
    const src = join(srcRoot, name, 'SKILL.md')
    try {
      await access(src)
    } catch {
      continue
    }
    const dest = join(destRoot, name)
    try {
      await access(join(dest, 'SKILL.md'))
      continue
    } catch {
      /* seed */
    }
    await mkdir(dest, { recursive: true })
    await cp(join(srcRoot, name), dest, { recursive: true })
    seeded.push(name)
  }
  return seeded
}
