const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

function personaPrefix(agent) {
  const prompt = agent && agent.ctx && agent.ctx.systemPrompt
  if (!prompt || !prompt.layers || typeof prompt.layers.merge !== 'function') return ''
  const merged = prompt.layers.merge(agent, (layer) => layer.sections)
  const section = merged && typeof merged.get === 'function' ? merged.get('deployment:persona-prefix') : null
  return section && typeof section.text === 'string' ? section.text : ''
}

function apply(ctx) {
  const dir = process.env.FDE_PROBE_DIR
  if (!dir) return
  ctx.on('agent/created', ({ agent }) => {
    const header = agent && agent.session && agent.session.header
    const preset = (header && header.agentPreset) || 'unknown'
    const payload = {
      preset,
      sessionId: (header && header.id) || '',
      names: [],
      personaPrefix: '',
      error: null,
    }
    try {
      payload.names = ctx.tools.schemas(agent).map((row) => row.name).sort()
      payload.personaPrefix = personaPrefix(agent)
    } catch (error) {
      payload.error = error instanceof Error ? error.message : String(error)
    }
    writeFileSync(join(dir, `${preset}.json`), `${JSON.stringify(payload)}\n`)
  })
}

module.exports = { apply, inject: ['tools'] }
