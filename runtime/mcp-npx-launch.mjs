#!/usr/bin/env node
import { runNpxWithCache } from './mcp-npx.mjs'

await runNpxWithCache(process.argv.slice(2))
