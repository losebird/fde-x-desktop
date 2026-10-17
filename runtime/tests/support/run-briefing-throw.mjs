import { DatabaseSync } from 'node:sqlite'

export async function runBriefing(_deps, input) {
  if (input && input.mode === 'full') {
    if (process.env.FDE_BRIEFING_DROP_WORKSPACE === '1' && process.env.FDE_DATABASE_PATH) {
      const db = new DatabaseSync(process.env.FDE_DATABASE_PATH)
      db.exec('DELETE FROM workspaces')
      db.close()
    }
    throw Object.assign(new Error('briefing generation failed'), { code: 'BRIEFING_TEST_THROW' })
  }
  return { briefingId: '', briefing: null }
}
