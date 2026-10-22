/**
 * Slash commands. They never enter model history unless the handler
 * explicitly followups — and only adopt does that, after a human click
 * on the dock. These commands only draft / name.
 * @module dsh-lan-assist/commands
 */

export function registerCommands(ctx, secretary) {
  if (!ctx.commands || typeof ctx.commands.register !== 'function') return

  const handler = async ({ agent, rawInput }) => {
    const parsed = parseAsk(rawInput)
    if (!parsed.name || !parsed.excerpt) {
      return { kind: 'error', text: '用法：/ask-colleague 称呼 正文。禁止只说发给他。' }
    }
    const view = await secretary.snapshot()
    const live = (view.peers || []).filter((p) => !p.unpaired)
    const matches = live.filter((p) => p.displayName === parsed.name || p.id === parsed.name || p.id.startsWith(parsed.name))
    if (matches.length !== 1) {
      const miss = await secretary.speakFindMiss({ name: parsed.name })
      const line = (miss.inbox && miss.inbox.find((row) => row.kind === 'miss') || {}).speak
      return { kind: 'error', text: line || `没配对「${parsed.name}」。花名册不能代替配对。` }
    }
    const peer = matches[0]
    const result = await secretary.compose({
      excerpt: parsed.excerpt,
      to: [peer.id],
      sessionId: agent && agent.id,
      workspace: agent && agent.session && agent.session.header
        ? String(agent.session.header.cwd || '').trim()
        : '',
    })
    if (!result.ok) {
      if (result.error === 'DUP') return { kind: 'error', text: result.hint || '已经在问。禁止默默再开一封。' }
      return { kind: 'error', text: result.error || '拟稿失败' }
    }
    return { kind: 'success', text: `打开聊天拟一封给 ${peer.displayName} ${peer.id.slice(0, 12)}…。人点发送才寄。模型未跑。` }
  }

  ctx.commands.register({
    name: 'ask-colleague',
    description: '打开聊天拟一封。点名收件人。人点发送才寄。模型未跑。',
    input: { hint: '称呼 正文' },
    handler,
  })

  ctx.commands.register({
    name: 'ask_colleague',
    description: '同 /ask-colleague。',
    input: { hint: '称呼 正文' },
    handler,
  })
}

function parseAsk(raw) {
  const text = String(raw || '').trim()
  const space = text.search(/\s/)
  if (space < 0) return { name: text, excerpt: '' }
  return { name: text.slice(0, space), excerpt: text.slice(space).trim() }
}
