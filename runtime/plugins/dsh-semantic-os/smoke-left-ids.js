/**
 * Tiny smoke: savePeople keeps v1.17 fields; GET /semantic-os/people/left-ids
 * returns ids of left people with a stable id.
 * Usage: node smoke-left-ids.js
 */
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleProduct } from './product.js'
import { peoplePath } from './people.js'

const LEFT = 'collab-left-1'
const ACTIVE = 'collab-active-1'
const SAVED = 'collab-saved-left'
const ALIAS = 'collab-alias-left'

async function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://dsh.local')
      const handled = await handleProduct(req, res, url, {
        sidecar: { snapshot: () => ({ ready: false }) },
        getConfig: () => ({}),
        ingest: { snapshot: () => ({}) },
        writes: null,
      })
      if (handled === false) {
        res.writeHead(404)
        res.end()
      }
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

async function get(server, path) {
  const { port } = server.address()
  const res = await fetch(`http://127.0.0.1:${port}${path}`)
  const body = await res.json()
  return { status: res.status, body }
}

async function post(server, path, payload) {
  const { port } = server.address()
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  return { status: res.status, body }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const root = join(tmpdir(), `dsh-left-ids-${Date.now()}`)
  process.env.DSH_HOME = root
  const file = peoplePath()
  const server = await serve()

  try {
    const missing = await get(server, '/semantic-os/people/left-ids')
    if (missing.status !== 200 || JSON.stringify(missing.body) !== JSON.stringify({ ids: [] })) {
      throw new Error(`missing file: expected 200 {ids:[]} got ${missing.status} ${JSON.stringify(missing.body)}`)
    }

    await mkdir(join(root, 'semantic-os'), { recursive: true })
    await writeFile(file, `${JSON.stringify({
      version: 1,
      people: [
        { id: LEFT, displayName: 'Left One', status: 'left', updatedAt: '2026-08-19T00:00:00Z' },
        { id: ACTIVE, displayName: 'Still Here', status: 'active', updatedAt: '2026-08-19T00:00:00Z' },
        { displayName: 'Left no id', status: 'left' },
      ],
    }, null, 2)}\n`, 'utf8')

    const hit = await get(server, '/semantic-os/people/left-ids')
    if (hit.status !== 200 || JSON.stringify(hit.body) !== JSON.stringify({ ids: [LEFT] })) {
      throw new Error(`filter: expected 200 {ids:[${LEFT}]} got ${hit.status} ${JSON.stringify(hit.body)}`)
    }

    const savedAt = '2026-08-19T12:00:00Z'
    const saved = await post(server, '/semantic-os/people', {
      people: [
        {
          id: SAVED,
          displayName: 'Saved Left',
          businessAccount: 'acct-left',
          status: 'left',
          updatedAt: savedAt,
        },
        { id: ACTIVE, name: 'Still Here', status: 'active' },
        { id: ALIAS, name: 'Alias Left', status: 'left' },
      ],
    })
    assert(saved.status === 200 && saved.body && saved.body.ok, `save: ${saved.status} ${JSON.stringify(saved.body)}`)
    const rows = saved.body.people || []
    const savedRow = rows.find((r) => r.id === SAVED)
    assert(savedRow, 'save missing SAVED row')
    assert(savedRow.displayName === 'Saved Left', `displayName dropped: ${JSON.stringify(savedRow)}`)
    assert(savedRow.businessAccount === 'acct-left', `businessAccount dropped: ${JSON.stringify(savedRow)}`)
    assert(savedRow.status === 'left', `status dropped: ${JSON.stringify(savedRow)}`)
    assert(savedRow.updatedAt === savedAt, `updatedAt dropped: ${JSON.stringify(savedRow)}`)
    assert(!('name' in savedRow) && !('note' in savedRow), `legacy fields still written: ${JSON.stringify(savedRow)}`)
    const aliasRow = rows.find((r) => r.id === ALIAS)
    assert(aliasRow && aliasRow.displayName === 'Alias Left', `name alias failed: ${JSON.stringify(aliasRow)}`)

    const after = await get(server, '/semantic-os/people/left-ids')
    const ids = after.body && after.body.ids
    if (after.status !== 200 || !Array.isArray(ids) || !ids.includes(SAVED) || !ids.includes(ALIAS) || ids.includes(ACTIVE)) {
      throw new Error(`save then left-ids: expected ${SAVED} and ${ALIAS} got ${after.status} ${JSON.stringify(after.body)}`)
    }

    const disk = JSON.parse(await readFile(file, 'utf8'))
    const diskSaved = (disk.people || []).find((r) => r.id === SAVED)
    assert(diskSaved && diskSaved.status === 'left' && diskSaved.displayName === 'Saved Left' && diskSaved.businessAccount === 'acct-left', `disk dropped fields: ${JSON.stringify(diskSaved)}`)

    console.log('ok', file, after.body)
  } finally {
    server.close()
    await rm(root, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err)
  process.exit(1)
})
