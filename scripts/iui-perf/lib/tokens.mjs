import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)
const vendor = join(tmpdir(), 'iui-perf-tokenizer')

let encoderPromise

function loadEncoder() {
  if (!encoderPromise) encoderPromise = installEncoder()
  return encoderPromise
}

async function installEncoder() {
  await mkdir(vendor, { recursive: true })
  await writeFile(join(vendor, 'package.json'), '{"private":true,"name":"iui-perf-tokenizer"}\n')
  const require = createRequire(join(vendor, 'package.json'))
  try {
    return require('js-tiktoken')
  } catch {
    await execFileAsync('npm', ['install', '--prefix', vendor, 'js-tiktoken@1.0.21', '--no-audit', '--no-fund'], {
      maxBuffer: 16 * 1024 * 1024,
    })
    return require('js-tiktoken')
  }
}

export const TOKENIZER_NAME = 'js-tiktoken o200k_base'

export async function countTokens(text) {
  const lib = await loadEncoder()
  const enc = lib.getEncoding('o200k_base')
  try {
    return enc.encode(String(text ?? '')).length
  } finally {
    if (typeof enc.free === 'function') enc.free()
  }
}
