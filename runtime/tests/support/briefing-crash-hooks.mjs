export async function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL || ''
  if (parent.endsWith('/runtime/routes/briefing.mjs') && specifier.endsWith('/briefing/run.mjs')) {
    return {
      url: new URL('./run-briefing-throw.mjs', import.meta.url).href,
      shortCircuit: true,
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  const loaded = await nextLoad(url, context)
  if (!url.endsWith('/runtime/dsh-core.mjs') || process.env.FDE_BRIEFING_CRASH_PROBE !== '1') return loaded
  let source = loaded.source
  if (source instanceof Uint8Array) source = Buffer.from(source).toString('utf8')
  if (typeof source !== 'string') return loaded
  const extra = `
const __fdeBriefingStatus = DshCoreConnector.prototype.status
DshCoreConnector.prototype.status = function () {
  const status = __fdeBriefingStatus.call(this)
  return { ...status, connected: true }
}
const __fdeBriefingCall = DshCoreConnector.prototype.call
DshCoreConnector.prototype.call = async function (endpoint, payload) {
  if (endpoint === 'workspace/create') {
    const { realpathSync } = await import('node:fs')
    const requested = String(payload?.request?.path || '')
    const path = realpathSync(requested)
    return { created: true, workspace: { workspaceId: 'ws_probe', path, title: '' } }
  }
  return __fdeBriefingCall.call(this, endpoint, payload)
}
`
  return { format: 'module', source: `${source}\n${extra}`, shortCircuit: true }
}
