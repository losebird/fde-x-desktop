export const LIVE_PATH: '/live'
export const LIVE_PROBE_MS: 1000
export function liveProbeBody(): { service: 'fde-x-runtime'; live: true }
export function combineAbortSignal(parent?: AbortSignal, timeoutMs?: number): AbortSignal
export function probeRuntimeLive(url: string, signal?: AbortSignal, timeoutMs?: number): Promise<boolean>
export function withProbeTimeout<T>(promise: Promise<T> | T, timeoutMs?: number): Promise<T>
