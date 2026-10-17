import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

export async function readIuiPin(artifact) {
  const listed = await execFileAsync('tar', ['-tzf', artifact], { timeout: 60000, encoding: 'utf8' })
  const pinName = listed.stdout.split('\n').map((line) => line.trim()).find((name) => {
    return name === IUI_PIN_FILE || name === `./${IUI_PIN_FILE}`
  })
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
    return { commit }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
