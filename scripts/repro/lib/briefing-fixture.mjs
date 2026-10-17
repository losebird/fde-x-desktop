import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configureEventBus, subscribe } from '../../../runtime/events.mjs'
import { openDatabase } from '../../../runtime/db.mjs'
import { parseMcpPatchEntries, upsertMcpPatchEntry } from '../../../runtime/mcp-archive.mjs'
import { listSessionProjectedToolNames } from '../../../runtime/routes/mcp.mjs'
import { saveDefinition } from '../../../runtime/briefing/store.mjs'
import { runBriefing } from '../../../runtime/briefing/run.mjs'

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const migrations = join(repoRoot, 'runtime', 'migrations')
export const fakeMcpScript = join(repoRoot, 'scripts', 'repro', 'fake-mcp-stdio.mjs')

const MAIL_TOOL = 'mcp__mail__imap_search'
const NEWS_TOOL = 'mcp__ai-hot__aihot_get_latest'

function writeFrame(child, message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8')
  child.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`)
  child.stdin.write(payload)
}

function readFrames(child, ms) {
  return new Promise((resolve, reject) => {
    const frames = []
    let buffer = Buffer.alloc(0)
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`fake mcp timed out after ${frames.length} frames`))
    }, ms)
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n')
        if (headerEnd < 0) return
        const header = buffer.slice(0, headerEnd).toString('utf8')
        const match = /Content-Length:\s*(\d+)/i.exec(header)
        if (!match) {
          buffer = buffer.slice(headerEnd + 4)
          continue
        }
        const length = Number(match[1])
        const start = headerEnd + 4
        if (buffer.length < start + length) return
        frames.push(JSON.parse(buffer.slice(start, start + length).toString('utf8')))
        buffer = buffer.slice(start + length)
        if (frames.length >= 3) {
          cleanup()
          resolve(frames)
        }
      }
    }
    const cleanup = () => {
      clearTimeout(timer)
      child.stdout.off('data', onData)
    }
    child.stdout.on('data', onData)
  })
}

export async function speakFakeMcp(serverName) {
  const child = spawn(process.execPath, [fakeMcpScript, serverName], { stdio: ['pipe', 'pipe', 'pipe'] })
  const stderr = []
  child.stderr.on('data', (chunk) => stderr.push(chunk.toString('utf8')))
  const pending = readFrames(child, 4000)
  writeFrame(child, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'repro', version: '0' } } })
  writeFrame(child, { jsonrpc: '2.0', method: 'notifications/initialized' })
  writeFrame(child, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  writeFrame(child, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: serverName === 'ai-hot' ? 'aihot_get_latest' : 'imap_search', arguments: {} } })
  try {
    const frames = await pending
    child.kill()
    return {
      serverName,
      toolNames: frames.find((frame) => frame.id === 2)?.result?.tools?.map((tool) => tool.name) || [],
      callText: frames.find((frame) => frame.id === 3)?.result?.content?.[0]?.text || '',
    }
  } catch (error) {
    child.kill()
    error.stderr = stderr.join('')
    throw error
  }
}

export async function writeUserStylePatch(homeDir) {
  const profileDir = join(homeDir, 'profiles', 'fde-x')
  await mkdir(profileDir, { recursive: true })
  let text = ''
  for (const serverName of ['mail', 'ai-hot']) {
    text = upsertMcpPatchEntry(text, {
      serverName,
      transport: 'stdio',
      command: process.execPath,
      args: [fakeMcpScript, serverName],
      disabled: false,
    })
  }
  const patchPath = join(profileDir, 'cordis.patch.yml')
  await writeFile(patchPath, text)
  return { patchPath, text, entries: parseMcpPatchEntries(text) }
}

function wireSnapshot(sessionId, cwd) {
  return {
    type: 'snapshot',
    header: {
      version: 1,
      id: sessionId,
      createdAt: Date.now(),
      cwd,
      agentPreset: 'fde-briefing',
    },
    records: [],
  }
}

function sectionError(briefing, title) {
  const section = (briefing?.sections || []).find((row) => row.title === title)
  return {
    error: section?.error || '',
    items: Array.isArray(section?.items) ? section.items.length : 0,
  }
}

export async function runProjectionBriefing() {
  const root = await mkdtemp(join(tmpdir(), 'fde-briefing-repro-'))
  const homeDir = join(root, 'home')
  const cwd = join(root, 'ws')
  await mkdir(cwd, { recursive: true })
  const patch = await writeUserStylePatch(homeDir)
  const spoken = []
  for (const serverName of ['mail', 'ai-hot']) spoken.push(await speakFakeMcp(serverName))

  const dbPath = join(root, 'repro.sqlite')
  const db = openDatabase(dbPath, migrations)
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO workspaces (id, name, description, status, metadata_json, created_at, updated_at)
    VALUES ('ws_repro', 'repro', '', 'active', ?, ?, ?)
  `).run(JSON.stringify({ cwd }), now, now)
  saveDefinition(db, cwd, {
    sections: [
      { id: 'mail', type: 'mcp', title: '重要邮件', enabled: true, render: 'list', params: { server: 'mail', tool: MAIL_TOOL, limit: 8 } },
      { id: 'news', type: 'mcp', title: '行业资讯', enabled: true, render: 'list', params: { server: 'ai-hot', tool: NEWS_TOOL, limit: 8 } },
    ],
    schedule: { at: '08:30', days: [1, 2, 3, 4, 5], onOpen: false, tz: 'Asia/Shanghai' },
    delivery: { peerId: '' },
  })

  const calls = []
  let createdId = ''
  const aiRuntime = {
    status: () => ({ connected: true }),
    call: async (endpoint, args) => {
      calls.push({ endpoint, args })
      if (endpoint === 'session/list') {
        if (!createdId) return { items: [] }
        return {
          items: [{
            sessionId: createdId,
            cwd,
            running: false,
            projections: { values: { agentPreset: 'fde-briefing', cwd } },
          }],
        }
      }
      if (endpoint === 'session/create') {
        createdId = 'brief-new'
        return { sessionId: createdId }
      }
      if (endpoint === 'session/prompt') return {}
      throw new Error(`unexpected ${endpoint}`)
    },
    async *stream(endpoint) {
      calls.push({ endpoint, stream: true })
      if (endpoint === 'session/follow') yield wireSnapshot(createdId || 'brief-new', cwd)
    },
  }

  const projectedBeforePrompt = await listSessionProjectedToolNames(aiRuntime, 'brief-new')
  const events = []
  configureEventBus(db)
  const unsubscribe = subscribe((envelope) => events.push(envelope.type))
  let result
  try {
    result = await runBriefing({ db, aiRuntime }, { workspaceCwd: cwd, mode: 'full' })
  } finally {
    unsubscribe()
  }
  const briefing = result.briefing
  const prompt = calls.find((row) => row.endpoint === 'session/prompt')
  const create = calls.find((row) => row.endpoint === 'session/create')
  return {
    root,
    patchPath: patch.patchPath,
    patchEntries: patch.entries.map((row) => ({
      serverName: row.serverName,
      command: row.command,
      args: row.args,
      disabled: row.disabled,
    })),
    spoken,
    projectedBeforePrompt,
    sessionCreate: create
      ? { cwd: create.args?.request?.cwd, agentPreset: create.args?.request?.agentPreset, sessionId: createdId }
      : null,
    promptCalled: Boolean(prompt),
    promptText: prompt?.args?.request?.content?.[0]?.text || '',
    events,
    mail: sectionError(briefing, '重要邮件'),
    news: sectionError(briefing, '行业资讯'),
    status: briefing?.status || '',
  }
}

export async function removeFixtureRoot(root) {
  if (root) await rm(root, { recursive: true, force: true })
}
