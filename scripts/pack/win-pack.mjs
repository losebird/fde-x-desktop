#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const desktopRoot = resolve(repoRoot, 'apps', 'desktop')
const stageScript = resolve(here, 'stage.mjs')
const packOut = resolve(repoRoot, 'resources-win32-x64')

export function packWinSteps() {
  return {
    stage: { cmd: process.execPath, args: [stageScript], cwd: repoRoot },
    builder: {
      cmd: 'pnpm',
      args: ['exec', 'electron-builder', '--win', '--x64', '--publish', 'never'],
      cwd: desktopRoot,
    },
    packOut,
  }
}

function packEnv(base = process.env) {
  return {
    ...base,
    FDE_PACK_PLATFORM: 'win32',
    FDE_PACK_ARCH: 'x64',
    FDE_PACK_OUT: packOut,
    FDE_ELECTRON_RESOURCES: relative(desktopRoot, packOut),
    FDE_DOWNLOAD_SEMANTIC_RUNTIME: base.FDE_DOWNLOAD_SEMANTIC_RUNTIME || '1',
    FDE_RESTAGE_DSH: '1',
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  }
}

async function main() {
  const env = packEnv()
  const steps = packWinSteps()
  console.log(`[pack:win] staging ${packOut}`)
  const staged = spawn(steps.stage.cmd, steps.stage.args, {
    cwd: steps.stage.cwd,
    env,
    stdio: 'inherit',
  })
  const stageCode = await new Promise((resolveExit) => staged.on('exit', resolveExit))
  if (stageCode !== 0) process.exit(stageCode || 1)

  console.log('[pack:win] electron-builder --win --x64 (nsis + zip)')
  const child = spawn(steps.builder.cmd, steps.builder.args, {
    cwd: steps.builder.cwd,
    env,
    stdio: 'inherit',
  })
  const code = await new Promise((resolveExit) => child.on('exit', resolveExit))
  process.exit(code || 0)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
