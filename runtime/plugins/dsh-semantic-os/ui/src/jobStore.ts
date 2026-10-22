/** Tiny in-memory job store so a long fetch survives workspace unmount. */
export function createJobStore<T extends object>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set: (patch: Partial<T>) => {
      state = { ...state, ...patch }
      listeners.forEach((fn) => fn())
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}
