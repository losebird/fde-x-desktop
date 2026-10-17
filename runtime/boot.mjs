import { ensureGenerationHost } from './generation.mjs'

await ensureGenerationHost()
await import('./server.mjs')
