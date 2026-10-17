import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export const IUI_PIN_FILE = 'fde-plugin-pin.json'

export function artifactAcquireHint() {
  return [
    '在分支 cursor/iui-pack-pin-6fc8 上执行 pnpm install --frozen-lockfile，然后 node scripts/pack/build-iui.mjs。',
    '产物文件名形状是 iui-<commit>.tar.gz，默认在 scripts/pack/.cache/。',
    '仓库没有发布这个包。.github/workflows/iui-tar-sha.yml 只在该分支构建并核对 sha256，不上传产物。',
    '把 tar.gz 的路径放进环境变量 FDE_IUI_ARTIFACT。commit 只读包内的 fde-plugin-pin.json。',
  ].join('')
}

export function missingExpectedPinMessage() {
  return [
    '需要先合 PR-9。',
    '期望的 IUI 钉值只在 runtime/iui-pin.mjs，里面有 commit、version 和 artifact.sha256。',
    '这条分支不另写一份钉值。',
    'PR-9 合入之前，测量无法核对包。',
  ].join('')
}

function tarMember(listed, base) {
  return listed.split('\n').map((line) => line.trim()).find((name) => name === base || name === `./${base}`)
}

async function listTar(artifact) {
  const listed = await execFileAsync('tar', ['-tzf', artifact], { timeout: 60000, encoding: 'utf8' })
  return listed.stdout
}

async function readDeclaredCommit(artifact) {
  const listed = await listTar(artifact)
  const pinName = tarMember(listed, IUI_PIN_FILE)
  if (!pinName) throw new Error(`产物里没有 fde-plugin-pin.json。${artifactAcquireHint()}`)
  const dir = await mkdtemp(join(tmpdir(), 'iui-pin-'))
  try {
    await execFileAsync('tar', ['-xzf', artifact, '-C', dir, pinName], { timeout: 60000 })
    const raw = await readFile(join(dir, IUI_PIN_FILE), 'utf8')
    const parsed = JSON.parse(raw)
    const commit = parsed && typeof parsed.commit === 'string' ? parsed.commit : ''
    if (!/^[0-9a-f]{7,64}$/.test(commit)) {
      throw new Error(`产物里的 fde-plugin-pin.json 没有 commit。${artifactAcquireHint()}`)
    }
    return commit
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function readPackageVersion(artifact) {
  const listed = await listTar(artifact)
  const name = tarMember(listed, 'package.json')
  if (!name) throw new Error(`产物里没有 package.json。${artifactAcquireHint()}`)
  const { stdout } = await execFileAsync('tar', ['-xOf', artifact, name], {
    timeout: 60000,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  })
  const parsed = JSON.parse(stdout)
  const version = parsed && typeof parsed.version === 'string' ? parsed.version : ''
  if (!version) throw new Error(`产物里的 package.json 没有 version。${artifactAcquireHint()}`)
  return version
}

export async function loadExpectedPin(pinFile) {
  if (!pinFile || !existsSync(pinFile)) throw new Error(missingExpectedPinMessage())
  const imported = await import(pathToFileURL(pinFile).href)
  const pin = imported && imported.IUI_PIN
  const commit = pin && typeof pin.commit === 'string' ? pin.commit : ''
  const version = pin && typeof pin.version === 'string' ? pin.version : ''
  const sha256 = pin && pin.artifact && typeof pin.artifact.sha256 === 'string' ? pin.artifact.sha256 : ''
  if (!/^[0-9a-f]{7,64}$/.test(commit) || !version || !/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error(`钉值文件缺少 commit、version 或 artifact.sha256。${missingExpectedPinMessage()}`)
  }
  return { commit, version, sha256 }
}

async function matchArtifact(artifact, expected) {
  const digest = createHash('sha256').update(await readFile(artifact)).digest('hex')
  if (digest !== expected.sha256) {
    throw new Error(`产物 sha256 是 ${digest}，钉值是 ${expected.sha256}。包内容和钉值不一致。`)
  }
  const version = await readPackageVersion(artifact)
  if (version !== expected.version) {
    throw new Error(`产物 version 是 ${version}，钉值是 ${expected.version}。`)
  }
  const commit = await readDeclaredCommit(artifact)
  if (commit !== expected.commit) {
    throw new Error(`产物 commit 是 ${commit}，钉值是 ${expected.commit}。`)
  }
  return { commit, version, sha256: digest }
}

export async function readIuiPin(artifact, pinFile) {
  if (arguments.length >= 2) return matchArtifact(artifact, await loadExpectedPin(pinFile))
  return { commit: await readDeclaredCommit(artifact) }
}
