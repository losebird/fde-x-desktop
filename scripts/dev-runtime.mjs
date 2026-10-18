export async function ensureOwnedRuntime({ preferredPort, portOpen, spawnOwned }) {
  if (await portOpen(preferredPort)) {
    return { port: preferredPort, token: '', keptPids: [] }
  }
  const owned = await spawnOwned({ port: preferredPort, keepPids: [] })
  return { port: owned.port, token: owned.token, keptPids: [] }
}
