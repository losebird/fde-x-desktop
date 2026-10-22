#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createWriteStream, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertMergedPlugins, loadPins, readEnvFile } from './test-env/plugin-tree.mjs'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const envPath = join(repoRoot, '.test-env')
const logPath = join(repoRoot, '.test-strict.log')
const pinsPath = join(repoRoot, 'scripts', 'test-env', 'vendor-pins.json')
const allowPath = join(repoRoot, 'scripts', 'test-env', 'skip-allow.json')

function diagnosticType(lines, start) {
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '...') break
    const typed = line.match(/^\s*type:\s*['"]?(test|suite)['"]?\s*$/u)
    if (typed) return typed[1]
  }
  return ''
}

export function parseTap(text) {
  const lines = String(text).split('\n')
  const skips = []
  const failures = []
  const summary = {}
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const skip = line.match(/^\s*ok\b.*# SKIP(?:\s+(.*))?$/u)
    if (skip) skips.push((skip[1] || '').trim())
    const count = line.match(/^# (tests|suites|pass|fail|cancelled|skipped|todo)\s+(\d+)\s*$/u)
    if (count) summary[count[1]] = Number(count[2])
    const failed = line.match(/^\s*not ok\s+\d+\s+-\s+(.*)$/u)
    if (!failed) continue
    if (diagnosticType(lines, index + 1) === 'suite') continue
    failures.push(failed[1].trim())
  }
  return { skips, failures, summary }
}

export function disallowedSkips(skips, reasons) {
  const allow = new Set(reasons)
  return skips.filter((reason) => !allow.has(reason))
}

function loadAllow() {
  const raw = JSON.parse(readFileSync(allowPath, 'utf8'))
  if (!raw || !Array.isArray(raw.reasons) || raw.reasons.some((reason) => typeof reason !== 'string')) {
    throw new Error(`${allowPath} must be { "reasons": [] }`)
  }
  return raw.reasons
}

function childEnv(envFile) {
  const env = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' }
  // mcpArchivePaths treats a set FDE_DSH_HOME as the profile archive and ignores patchFile.
  delete env.FDE_DSH_HOME
  delete env.FDE_IUI_ARTIFACT
  delete env.FDE_REFRESH_PLUGINS
  delete env.FDE_TEST_DSH_HOME
  const forward = ['FDE_VENDOR_DIR', 'FDE_PLUGIN_DSH_SEMANTIC_OS', 'FDE_PLUGIN_IUI', 'COREPACK_HOME']
  for (const key of forward) {
    if (envFile[key]) env[key] = envFile[key]
  }
  return env
}

function defaultTests() {
  return readdirSync(join(repoRoot, 'runtime', 'tests'))
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => join('runtime', 'tests', name))
}

function writeSummary(stream, lines) {
  const text = `${lines.join('\n')}\n`
  console.log(text.trimEnd())
  stream.write(text)
}

function main() {
  const logStream = createWriteStream(logPath, { flags: 'w' })
  const envFile = readEnvFile(envPath)
  if (!envFile || !envFile.FDE_TEST_DSH_HOME || !envFile.FDE_PLUGIN_DSH_SEMANTIC_OS) {
    writeSummary(logStream, [`missing ${envPath}. Run pnpm test:env. Refusing to skip.`])
    logStream.end(() => process.exit(1))
    return
  }
  try {
    const pins = loadPins(pinsPath)
    assertMergedPlugins({ repoRoot, dshHome: envFile.FDE_TEST_DSH_HOME, plugins: pins.plugins })
  } catch (error) {
    writeSummary(logStream, [error instanceof Error ? error.message : String(error), 'test:strict failed before the suite'])
    logStream.end(() => process.exit(1))
    return
  }
  const allow = loadAllow()
  const files = process.argv.slice(2).filter((arg) => arg !== '--')
  const tests = files.length > 0 ? files : defaultTests()
  const child = spawn(process.execPath, [
    '--test',
    '--test-concurrency=1',
    '--test-reporter=tap',
    ...tests,
  ], {
    cwd: repoRoot,
    env: childEnv(envFile),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let tap = ''
  const take = (chunk) => {
    const text = chunk.toString()
    process.stdout.write(text)
    logStream.write(text)
    tap += text
  }
  child.stdout.on('data', take)
  child.stderr.on('data', take)
  child.on('error', (error) => {
    writeSummary(logStream, [`failed to start node --test: ${error.message}`])
    logStream.end(() => process.exit(1))
  })
  child.on('close', (code) => {
    const parsed = parseTap(tap)
    const skipped = parsed.summary.skipped
    const bad = disallowedSkips(parsed.skips, allow)
    const lines = [
      'test:strict summary',
      `tests ${parsed.summary.tests ?? 'missing'}`,
      `pass ${parsed.summary.pass ?? 'missing'}`,
      `fail ${parsed.summary.fail ?? 'missing'}`,
      `skipped ${skipped ?? 'missing'}`,
    ]
    let exit = code == null ? 1 : code
    if (parsed.summary.tests == null || skipped == null) {
      lines.push('node --test did not print a TAP summary. Refusing to treat that as zero skips.')
      exit = 1
    } else if (skipped !== parsed.skips.length) {
      lines.push(`parsed ${parsed.skips.length} SKIP lines but the summary says skipped ${skipped}`)
      exit = 1
    } else if (bad.length > 0) {
      lines.push(`disallowed skips: ${bad.length}`)
      for (const reason of bad) lines.push(`- ${reason}`)
      exit = 1
    }
    if ((parsed.summary.fail || 0) > 0 || (parsed.summary.cancelled || 0) > 0) exit = 1
    if (parsed.failures.length > 0) {
      lines.push('failures:')
      for (const name of parsed.failures) lines.push(`- ${name}`)
    }
    writeSummary(logStream, lines)
    logStream.end(() => process.exit(exit))
  })
}

const isMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
