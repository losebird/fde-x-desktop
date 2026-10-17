import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const PROFILE_PATCH_RECIPE = `set -eu
umask 077
if [ -n "\${FDE_DSH_HOME:-}" ]; then
  printf '%s\\n' '不要设置 FDE_DSH_HOME。补丁写在默认家目录 ~/.dsh-fde-x。' >&2
  exit 1
fi
mkdir -p "$HOME/.dsh-fde-x"
cred="$HOME/.dsh-fde-x/.credentials.yaml"
if [ ! -f "$cred" ]; then
  printf 'version: 1\\nrefs:\\n' > "$cred"
  chmod 600 "$cred"
fi
port="\${FDE_RUNTIME_PORT:-4318}"
log="$HOME/.dsh-fde-x/fde-boot.log"
pidfile="$HOME/.dsh-fde-x/fde-server.pid"
FDE_DATABASE_PATH="\${FDE_DATABASE_PATH:-$HOME/.dsh-fde-x/fde.sqlite}" \\
FDE_AI_WORKSPACE="\${FDE_AI_WORKSPACE:-$HOME}" \\
FDE_VENDOR_DIR="\${FDE_VENDOR_DIR:-$HOME/.dsh-fde-x/missing-vendor}" \\
FDE_SEMANTIC_RUNTIME_MODE="\${FDE_SEMANTIC_RUNTIME_MODE:-readonly}" \\
FDE_LISTEN_HOST=127.0.0.1 \\
FDE_RUNTIME_PORT="$port" \\
node runtime/server.mjs >"$log" 2>&1 &
echo $! > "$pidfile"
ready=0
i=0
while [ "$i" -lt 30 ]; do
  if grep -q FDE_LISTENING "$log"; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
test "$ready" = 1
actual=$(sed -n 's/^FDE_LISTENING //p' "$log" | tail -n 1)
curl -fsS -m 90 -X POST "http://127.0.0.1:\${actual}/api/v1/ai/connect" \\
  -H "origin: http://127.0.0.1:\${actual}" \\
  -H 'content-type: application/json' \\
  -d '{}' >/dev/null
test -s "$HOME/.dsh-fde-x/profiles/fde-x/cordis.patch.yml"
`

export function liveProfilePatchMessage(file) {
  const error = [
    `找不到 profile 补丁 ${file}。`,
    '这是 FDE 的 fde-x profile 补丁 cordis.patch.yml，里面是这台机器上的插件行。',
    '默认家目录是 ~/.dsh-fde-x，文件在 profiles/fde-x/cordis.patch.yml。',
    'server 进程刚启动不会写这个文件。它在 POST /api/v1/ai/connect 时才出现。',
    '没有 ~/.dsh-fde-x/.credentials.yaml 时，connect 返回 502，文件也不会出现。',
    '不要复制 ~/.dsh/.credentials.yaml。密钥只放环境变量。',
    '不要设置 FDE_DSH_HOME。按下面的命令在默认家目录写一份空凭据，再 connect。',
    '```sh',
    PROFILE_PATCH_RECIPE.trim(),
    '```',
    '实时测量把生成的路径放进环境变量 IUI_PERF_PROFILE_PATCH。',
  ].join('\n')
  return error
}

export function assertLiveProfilePatch(options = {}) {
  if (options.staticMode) return
  const file = options.source === undefined ? process.env.IUI_PERF_PROFILE_PATCH : options.source
  if (file && existsSync(file)) return
  const shown = file || join(homedir(), '.dsh-fde-x', 'profiles', 'fde-x', 'cordis.patch.yml')
  const error = new Error(liveProfilePatchMessage(shown))
  error.code = 'profile-patch'
  throw error
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
