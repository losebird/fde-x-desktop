import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export function liveProfilePatchMessage(file) {
  return [
    `找不到 profile 补丁 ${file}。`,
    '这是 FDE 的 fde-x profile 补丁 cordis.patch.yml，里面是这台机器上的插件行。',
    '默认家目录是 ~/.dsh-fde-x，文件在 profiles/fde-x/cordis.patch.yml。',
    '先启动一次 FDE，且不要另设 FDE_DSH_HOME：node runtime/server.mjs。',
    '启动时 ensureIsolatedProfile 会创建这个文件。',
    '实时测量把该路径放进环境变量 IUI_PERF_PROFILE_PATCH。',
  ].join('')
}

export function assertLiveProfilePatch(options = {}) {
  if (options.staticMode) return
  const file = options.source === undefined ? process.env.IUI_PERF_PROFILE_PATCH : options.source
  if (file && existsSync(file)) return
  const shown = file || join(homedir(), '.dsh-fde-x', 'profiles', 'fde-x', 'cordis.patch.yml')
  throw new Error(liveProfilePatchMessage(shown))
}

export async function applyProfilePatch(home, profileNames = ['fde-x', 'web']) {
  const source = process.env.IUI_PERF_PROFILE_PATCH
  if (!source) return { applied: false, profiles: [] }
  if (!existsSync(source)) throw new Error(liveProfilePatchMessage(source))
  const bytes = await readFile(source)
  const profiles = []
  for (const name of profileNames) {
    const dest = join(home, 'profiles', name, 'cordis.patch.yml')
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, bytes, { mode: 0o600 })
    profiles.push(name)
  }
  return { applied: true, profiles }
}
