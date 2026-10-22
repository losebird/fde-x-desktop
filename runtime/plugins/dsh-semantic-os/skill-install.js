/**
 * Install the occupancy project-memory skill into the FDE user-dsh skills root.
 * @module dsh-semantic-os/skill-install
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillSrc = fileURLToPath(new URL('./skills/project-memory/SKILL.md', import.meta.url))

export async function ensureProjectMemorySkill(home) {
  const root = String(home || '').trim()
  if (!root) return
  const destDir = join(root, 'skills', 'project-memory')
  await mkdir(destDir, { recursive: true })
  const body = await readFile(skillSrc, 'utf8')
  await writeFile(join(destDir, 'SKILL.md'), body)
}
