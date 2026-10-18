/**
 * Map Host sessionPersistence (list + open/read) onto the list/readFrom
 * shape session-ingest.js actually calls.
 * @module dsh-semantic-os/session-persistence-adapt
 */

function rowFromSnapshot(snapshot) {
  const header = snapshot && typeof snapshot === 'object' && snapshot.header && typeof snapshot.header === 'object'
    ? snapshot.header
    : snapshot
  const id = header && (header.id || (header.meta && header.meta.id)) || ''
  const cwd = header && (header.cwd || (header.meta && header.meta.cwd)) || ''
  return {
    id: String(id || ''),
    cwd: typeof cwd === 'string' ? cwd : String(cwd || ''),
    meta: header && typeof header === 'object' ? header : {},
  }
}

export function adaptSessionPersistence(sessionPersistence) {
  if (!sessionPersistence || typeof sessionPersistence.list !== 'function') return null
  if (typeof sessionPersistence.readFrom === 'function') return sessionPersistence
  if (typeof sessionPersistence.open !== 'function') return null
  return {
    async list() {
      const snapshots = await sessionPersistence.list()
      const rows = Array.isArray(snapshots) ? snapshots : []
      return rows.map(rowFromSnapshot)
    },
    async readFrom(id, fromSeq) {
      const handle = await sessionPersistence.open(id, 'read')
      try {
        const offset = Number.isFinite(Number(fromSeq)) ? Number(fromSeq) : 0
        const packed = await handle.read(offset)
        const events = packed && Array.isArray(packed.events) ? packed.events : []
        return { events }
      } finally {
        await handle.close()
      }
    },
  }
}
