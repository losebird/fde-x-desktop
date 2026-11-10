#!/usr/bin/env node
import { execFile as execFileCb, spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { parseCodesigningIdentities, packMacSignEnv, pickDeveloperIdApplication, notarizeEnvPresent } from './mac-identity.mjs'

const execFile = promisify(execFileCb)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const desktopRoot = resolve(repoRoot, 'apps', 'desktop')
const stageScript = resolve(here, 'stage.mjs')

export function packMacSteps() {
  return {
    stage: { cmd: process.execPath, args: [stageScript], cwd: repoRoot },
    builder: {
      cmd: 'pnpm',
      args: ['exec', 'electron-builder', '--mac', 'dmg', '--publish', 'never'],
      cwd: desktopRoot,
    },
  }
}

async function listIdentities() {
  try {
    const { stdout, stderr } = await execFile('security', ['find-identity', '-v', '-p', 'codesigning'])
    return parseCodesigningIdentities(`${stdout}\n${stderr}`)
  } catch (error) {
    return parseCodesigningIdentities(String(error?.stdout || error?.stderr || ''))
  }
}

async function main() {
  const identities = await listIdentities()
  const identity = pickDeveloperIdApplication(identities)
  const packed = packMacSignEnv({ identity, env: process.env })
  if (packed.mode === 'unsigned') {
    console.warn('[pack:mac] no Developer ID Application (and no CSC_LINK). Building unsigned. Gatekeeper will block other Macs.')
  } else {
    console.log(`[pack:mac] signing as ${packed.mode}${identity?.name ? `: ${identity.name}` : ''}`)
  }
  if (packed.mode !== 'unsigned' && !notarizeEnvPresent(packed.env)) {
    console.warn('[pack:mac] no notary credentials (APPLE_API_KEY* or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID). Skipping notarize.')
  }

  const steps = packMacSteps()
  console.log('[pack:mac] staging resources')
  const staged = spawn(steps.stage.cmd, steps.stage.args, {
    cwd: steps.stage.cwd,
    env: process.env,
    stdio: 'inherit',
  })
  const stageCode = await new Promise((resolveExit) => staged.on('exit', resolveExit))
  if (stageCode !== 0) process.exit(stageCode || 1)

  const child = spawn(steps.builder.cmd, steps.builder.args, {
    cwd: steps.builder.cwd,
    env: packed.env,
    stdio: 'inherit',
  })
  const code = await new Promise((resolveExit) => child.on('exit', resolveExit))
  if (code !== 0) process.exit(code || 1)
  await execFile('rm', ['-rf', 'dist-pack/mac-arm64'], { cwd: desktopRoot })
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
