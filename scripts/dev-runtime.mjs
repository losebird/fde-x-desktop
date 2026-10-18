export async function ensureOwnedRuntime({
  preferredPort,
  portOpen,
  listenersOn,
  childrenOf,
  spawnOwned,
}) {
  if (!(await portOpen(preferredPort))) {
    const owned = await spawnOwned({ port: preferredPort, keepPids: [] })
    return { port: owned.port, token: owned.token, keptPids: [] }
  }
  const occupants = await listenersOn(preferredPort)
  if (occupants.length === 0) {
    throw new Error(`${preferredPort} 已有进程在听，但没有查到它的 pid。没有另起核心，避免清掉正在运行的进程。停掉占用 ${preferredPort} 的进程后再运行 pnpm dev。`)
  }
  const keptPids = []
  for (const pid of occupants) {
    keptPids.push(pid)
    for (const kid of await childrenOf(pid)) keptPids.push(kid)
  }
  const owned = await spawnOwned({ port: 0, keepPids: [...new Set(keptPids)] })
  return { port: owned.port, token: owned.token, keptPids: [...new Set(keptPids)] }
}
