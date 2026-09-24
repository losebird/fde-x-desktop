/**
 * Host tools. list_visible never returns another person's mailbox.
 * @module dsh-lan-assist/tools
 */

import { messageIdOf, requestIdOf } from './conversation.js'
import { extractUserSpeech } from './semantic.js'
import { recalledUserSpeech, rememberUserSpeech } from './slots.js'

export function toolSessionId(exec) {
  const agent = exec && exec.agent
  const session = agent && agent.session
  const header = session && session.header
  return String(
    (session && (session.sessionId || session.id))
    || (header && (header.sessionId || header.id))
    || (agent && agent.id)
    || ''
  ).trim()
}

function lastUserSpeech(exec) {
  const sessionId = toolSessionId(exec)
  const recalled = recalledUserSpeech(sessionId)
  const session = exec && exec.agent && exec.agent.session
  const events = session && Array.isArray(session.events) ? session.events : []
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const extracted = extractUserSpeech(events[i])
    if (extracted) {
      rememberUserSpeech(sessionId, extracted)
      return extracted
    }
    const event = events[i]
    if (!event || event.type !== 'user/message') continue
    const data = event.data || {}
    const message = data.message || {}
    const blocks = Array.isArray(data.content)
      ? data.content
      : (Array.isArray(message.content) ? message.content : [])
    const texts = []
    for (const block of blocks) {
      if (block && block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        texts.push(block.text.trim())
      }
    }
    const line = texts.join('\n').trim()
    if (line) {
      rememberUserSpeech(sessionId, line)
      return line
    }
  }
  return recalled
}

export function toolWorkspace(exec) {
  const header = exec && exec.agent && exec.agent.session && exec.agent.session.header
  return header ? String(header.cwd || '').trim() : ''
}

export function registerTools(ctx, { defineTool }, secretary, rounds) {
  ctx.tools.register(defineTool({
    name: 'ask_colleague',
    description: 'Open chat and draft a letter to a paired colleague. Names the recipient. The human must click send. Does not auto-send. Does not wake the model on the far side.',
    parameters: {
      name: { type: 'string', required: true, description: 'Display name of a paired colleague' },
      excerpt: { type: 'string', required: true, description: 'Only the paragraph to send. Do not lift the whole session.' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const view = await secretary.snapshot()
      const found = matchPeers(view.peers, args.name)
      if (found.length !== 1) {
        const miss = await secretary.speakFindMiss({ name: args.name })
        return JSON.stringify({
          error: found.length > 1 ? 'AMBIGUOUS' : 'NO_PEER',
          hint: (miss.inbox && miss.inbox.find((row) => row.kind === 'miss') || {}).speak
            || `没配对「${args.name}」。花名册不能代替配对。`,
        })
      }
      const peer = found[0]
      const sessionId = toolSessionId(exec)
      const workspace = toolWorkspace(exec)
      const result = await secretary.compose({
        excerpt: args.excerpt,
        to: [peer.id],
        sessionId,
        workspace,
      })
      if (!result.ok) return JSON.stringify(result)
      return JSON.stringify({
        ok: true,
        requestId: result.requestId,
        messageId: messageIdOf(result.requestId, 'v1'),
        speak: `打开聊天拟一封给 ${peer.displayName} ${peer.id.slice(0, 12)}…。人点发送才寄。`,
        hint: '模型未寄。人在聊天窗点发送才寄。对面模型不跑。',
      })
    },
    presentCall() {
      return { card: 'generic', title: 'ask_colleague', kind: 'write' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_visible',
    description: 'List assistance the current user may see. Never dumps another mailbox.',
    parameters: {
      requestId: { type: 'string', description: 'Optional request id or messageId' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args) {
      const view = await secretary.snapshot()
      const selfId = view.self && view.self.id
      const rows = (view.requests || []).filter((req) => {
        if (args.requestId && req.id !== requestIdOf(args.requestId)) return false
        return (req.visible || []).includes(selfId) || req.from === selfId
      })
      return JSON.stringify({
        ok: true,
        visible: rows.map((req) => ({
          id: req.id,
          messageId: messageIdOf(req.id, 'v1'),
          from: req.fromName,
          status: req.status,
          excerpt: req.excerpt,
        })),
        redacted: '不在可见名单的信没有交给模型。',
      })
    },
    presentCall() {
      return { card: 'generic', title: 'list_visible', kind: 'read' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'biz_describe',
    description: '读本工作区已登记业务目录：型、能做的动作、字段、企业别名、可执行关系、目录版本。不是现查，不发令牌，不写库。填槽前先看这个。',
    parameters: {
      kind: { type: 'string', description: '可选。只看这一型。' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const result = await secretary.describeBiz({
        kind: args && args.kind,
        workspace: toolWorkspace(exec),
      })
      return JSON.stringify(result)
    },
    presentCall(args) {
      const kind = args && args.kind ? String(args.kind) : '目录'
      return { card: 'generic', title: `目录 ${kind}`.trim(), kind: 'read' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'biz_traces',
    description: '读本工作区账本回执，不是现查、不是 ERP。可按 id 或单号打开当时记录。没绑工作区拒。当前状态要 biz_preview。',
    parameters: {
      id: { type: 'string', description: '可选。账本里的 trace id 或信件 id。' },
      no: { type: 'string', description: '可选。单号。只查当时回执和发出的信。' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (typeof secretary.openTrace !== 'function') {
        return JSON.stringify({ ok: false, error: 'NO_TRACE' })
      }
      const result = await secretary.openTrace({
        id: args && args.id,
        no: args && args.no,
        workspace: toolWorkspace(exec),
      })
      return JSON.stringify(result)
    },
    presentCall() {
      return { card: 'generic', title: '账本', kind: 'read' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'biz_preview',
    description: '查、改、删、建、过审都走这里，结果出现在右边业务页。不要用 bash 查库。闸只验证槽，不理解原话。条件放 where，关联沿图放 from 或 steps（把话里提到的相关型一次走完，不限两个），改值放 patch。speech 放用户整句原话，闸会按词表+图 hop。没连上 / 不在名下 / 未登记型不发令牌。',
    parameters: {
      system: { type: 'string', description: '系统' },
      env: { type: 'string', description: '环境' },
      kind: { type: 'string', required: true, description: '最终要看或要改的型。未登记拒。' },
      no: { type: 'string', description: '单号槽。不要把整句条件塞进这里。' },
      line: { type: 'string', description: '明细行号' },
      action: { type: 'string', required: true, description: '现查、过审、改行、删除 或 新建。拿不准用现查。现查不发写令牌。' },
      speech: { type: 'string', description: '用户整句原话。多个相关型时闸按词表+图沿关系链 hop。空则用会话上一句。' },
      where: { type: 'json', description: '当前型的条件槽数组，每项 keys/values/not/dateBefore/dateAfter。' },
      from: { type: 'json', description: '关联起点：{kind, where, no, relation, from}。from 可再嵌套下一跳。把话里提到的相关型一次走完。' },
      steps: { type: 'json', description: '多跳计划，沿图把提到的相关型按顺序走完。有则优先生效。不限两跳。' },
      patch: { type: 'json', description: '改行或新建时的字段对象。键必须是表上能改的列，值要对上枚举。' },
      batch: { type: 'boolean', description: 'true 才对当前列表发批量写令牌。默认只列出让人勾。一次最多 100 条，清单以预览时服务器固定的 nos 为准。' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const sessionId = toolSessionId(exec)
      const workspace = toolWorkspace(exec)
      const result = await secretary.previewBiz({
        ...args,
        sessionId,
        workspace,
        speech: (args && (args.speech || args.quote)) || lastUserSpeech(exec) || '',
        userSpeech: lastUserSpeech(exec) || '',
      })
      if (rounds && typeof rounds.noteToolSheet === 'function') {
        const sheet = result && result.sheet && typeof result.sheet === 'object' ? result.sheet : result
        if (sheet && typeof sheet === 'object' && sessionId && !String(sheet.sessionId || '').trim()) {
          sheet.sessionId = sessionId
        }
        const outcome = rounds.noteToolSheet(sessionId, sheet)
        if (outcome && outcome.cancel) {
          const cancelKind = String(outcome.cancelKind || 'plugin-leftover').trim() || 'plugin-leftover'
          const live = exec && exec.agent
          if (live && typeof live.cancel === 'function') {
            try { live.cancel({ kind: cancelKind }, { keepInbox: true }) } catch { /* leftover cancel is best-effort */ }
          } else if (typeof rounds.cancelLeftover === 'function') {
            void Promise.resolve(rounds.cancelLeftover(sessionId, cancelKind)).catch(() => undefined)
          }
        }
      }
      return JSON.stringify(result)
    },
    presentCall(args) {
      const kind = args && args.kind ? String(args.kind) : '单'
      const no = args && args.no ? String(args.no) : ''
      return { card: 'generic', title: `预览 ${kind} ${no}`.trim(), kind: 'read' }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'biz_write',
    description: '必须带同一张 preview_id。无令牌 / 过期 / 已用过 / 指纹变了都拒。手打过一下和秘书点头走同一道闸。',
    parameters: {
      preview_id: { type: 'string', required: true, description: '刚才预览发的令牌' },
      trace_id: { type: 'string', description: '同一笔只许成功一次' },
      confirm: { type: 'boolean', description: '批量删除必须 true。普通改行不用。' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args) {
      const result = await secretary.commitWrite(args)
      return JSON.stringify(result)
    },
    presentCall(args) {
      return { card: 'generic', title: '执行写', kind: 'write', rawInput: args && args.preview_id }
    },
  }))
}

function matchPeers(peers, name) {
  const q = String(name || '').trim()
  if (!q) return []
  const live = (peers || []).filter((p) => !p.unpaired)
  const exact = live.filter((p) => p.displayName === q || p.id === q || p.staffId === q)
  if (exact.length) return exact
  return live.filter((p) => (p.displayName && p.displayName.includes(q)) || p.id.startsWith(q))
}
