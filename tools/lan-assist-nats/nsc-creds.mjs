#!/usr/bin/env node
/**
 * Official nsc only. Does not mint a homemade JWT.
 * `node scripts/nsc-creds.mjs`        — check nsc / docker
 * `node scripts/nsc-creds.mjs issue`  — local test operator into .nsc-local (gitignored)
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const store = resolve(root, '.nsc-local')
const creds = join(store, 'device.creds')
const credsB = join(store, 'device-b.creds')
const resolver = join(store, 'resolver.conf')

function run(cmd, args, env) {
  return spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...env } })
}

function haveNsc() {
  const got = run('nsc', ['--version'])
  return !(got.error || got.status !== 0)
}

function haveDocker() {
  const got = run('docker', ['--version'])
  return !(got.error || got.status !== 0)
}

function nsc(args) {
  if (haveNsc()) {
    return run('nsc', args, {
      NSC_HOME: store,
      NKEYS_PATH: join(store, 'keys'),
      XDG_DATA_HOME: store,
    })
  }
  if (!haveDocker()) {
    return { status: 1, error: new Error('NO_NSC'), stdout: '', stderr: '需要官方 nsc 或 docker。插件不签发 JWT。' }
  }
  mkdirSync(store, { recursive: true, mode: 0o700 })
  return run('docker', [
    'run', '--rm',
    '-v', `${store}:/nsc`,
    '-e', 'NSC_HOME=/nsc',
    '-e', 'NKEYS_PATH=/nsc/keys',
    '-e', 'XDG_DATA_HOME=/nsc',
    'natsio/nats-box',
    'nsc',
    ...args,
  ])
}

function fail(got) {
  const text = String((got && (got.stderr || got.stdout)) || (got && got.error && got.error.message) || 'nsc failed')
  console.error(text.trim())
  process.exit(got && got.status ? got.status : 1)
}

function printEnv() {
  console.log('本机测试 operator，不是生产 CA。')
  console.log(`export DSH_LAN_ASSIST_NATS=nats://127.0.0.1:4222`)
  console.log(`export DSH_LAN_ASSIST_NATS_CREDS=${creds}`)
  console.log(`# 第二台：export DSH_LAN_ASSIST_NATS_CREDS=${credsB}`)
  console.log('启动：docker compose -f docker/nats.jwt.yml up -d')
}

const mode = String(process.argv[2] || '').trim()

if (!mode) {
  if (haveNsc()) {
    const ver = run('nsc', ['--version'])
    console.log(String(ver.stdout || ver.stderr || '').trim() || 'nsc ok')
  } else if (haveDocker()) {
    console.log('本机无 nsc，可用 docker natsio/nats-box 里的官方 nsc。')
  } else {
    console.error('需要官方 nsc。插件不签发 JWT。装好 nsc 或 docker 后：node scripts/nsc-creds.mjs issue')
    process.exit(1)
  }
  if (existsSync(creds) && existsSync(resolver)) printEnv()
  else console.log('还没有本机测试 operator。签发：node scripts/nsc-creds.mjs issue')
  process.exit(0)
}

if (mode !== 'issue') {
  console.error('用法：node scripts/nsc-creds.mjs [issue]')
  process.exit(1)
}

if (existsSync(creds) && existsSync(resolver) && existsSync(credsB) && process.argv[3] !== '--force') {
  printEnv()
  process.exit(0)
}

mkdirSync(store, { recursive: true, mode: 0o700 })
const steps = [
  ['add', 'operator', '--generate-signing-key', '--sys', '-n', 'DSH'],
  ['edit', 'operator', '--service-url', 'nats://127.0.0.1:4222'],
  ['add', 'account', '-n', 'APP'],
  ['edit', 'account', 'APP', '--js-mem-storage', '-1', '--js-disk-storage', '-1'],
  ['add', 'user', '-n', 'device'],
  ['generate', 'creds', '-a', 'APP', '-n', 'device', '-o', haveNsc() ? creds : '/nsc/device.creds'],
  ['add', 'user', '-n', 'device-b'],
  ['generate', 'creds', '-a', 'APP', '-n', 'device-b', '-o', haveNsc() ? credsB : '/nsc/device-b.creds'],
  ['generate', 'config', '--mem-resolver', '--config-file', haveNsc() ? resolver : '/nsc/resolver.conf'],
]
for (const args of steps) {
  const got = nsc(args)
  if (got.error || got.status !== 0) fail(got)
}
if (!existsSync(creds) || !existsSync(credsB) || !existsSync(resolver)) {
  console.error('nsc 跑完但没有 device.creds / device-b.creds / resolver.conf')
  process.exit(1)
}
printEnv()
