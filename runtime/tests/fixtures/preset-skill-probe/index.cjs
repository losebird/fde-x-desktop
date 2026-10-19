const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

function apply(ctx) {
  const dir = process.env.FDE_PROBE_DIR
  if (!dir) return
  ctx.on('agent/created', async ({ agent }) => {
    const header = agent && agent.session && agent.session.header
    const preset = (header && header.agentPreset) || 'unknown'
    const wanted = JSON.parse(process.env.FDE_PROBE_SKILLS || '{}')
    const skillName = wanted[preset] || ''
    const payload = { preset, skillName, text: '', error: null }
    if (skillName) {
      try {
        const result = await ctx.tools.execute({
          name: 'skill',
          arguments: { name: skillName },
          agent,
          signal: new AbortController().signal,
          callId: `probe-${preset}`,
        })
        const blocks = result && result.content
        payload.text = Array.isArray(blocks) ? blocks.map((block) => (block && block.text) || '').join('\n') : ''
        if (result && result.isError) payload.error = payload.text || 'skill tool failed'
      } catch (error) {
        payload.error = error instanceof Error ? error.message : String(error)
      }
    }
    writeFileSync(join(dir, `${preset}.json`), `${JSON.stringify(payload)}\n`)
  })
}

module.exports = { apply, inject: ['tools'] }
