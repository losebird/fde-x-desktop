#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ID = 'com.fde-x.workstation'

export default async function afterPack(context) {
  if (process.env.CSC_LINK) return
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false') return
  const name = context?.packager?.appInfo?.productFilename || 'FDE-X'
  const app = join(context.appOutDir, `${name}.app`)
  if (!existsSync(app)) {
    throw new Error(`afterPack adhoc sign: missing ${app}`)
  }
  const entitlements = join(context.packager.info.projectDir, 'build/entitlements.mac.plist')
  const args = ['--force', '--sign', '-', '--identifier', ID]
  if (existsSync(entitlements)) args.push('--entitlements', entitlements)
  args.push('--options', 'runtime', app)
  console.log(`[afterPack] adhoc sign ${ID} ${app}`)
  execFileSync('codesign', args, { stdio: 'inherit' })
}
