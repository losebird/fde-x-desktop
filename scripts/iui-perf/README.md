# IUI grok2api 首轮测量

同一句杭州三天提示。A 是裸 `@deepseek-ai/dsh` 0.2.0-rc.2 加 `FDE_IUI_ARTIFACT` 里的 IUI，协议 `openai-completions`。commit、version 和 sha256 跟 `runtime/iui-pin.mjs` 对。B 是 fde-x 标准对话，协议 `openai-responses`。两边模型都是 `grok-4.6`。每次都是新的 HOME、新会话。

endpoint 读 `GROK2API_BASE_URL`，默认 `http://127.0.0.1:8000/v1`。key 只读 `GROK2API_API_KEY`，写进子进程环境，不写进 settings、凭证文件或请求日志。settings 里只记环境变量名 `apiKeyEnv`。

默认同时跑 effort `low` 和 `high`（`IUI_PERF_EFFORTS`，逗号分隔；不设就两组都跑）。对照臂 `B-default` 不写 `reasoningEffort`。每臂冷启动次数读 `IUI_PERF_RUNS`，默认 3。`--static` 时每臂 1 次。

汇总按组分开写中位数和波动，并把首 token 与生成耗时分开。计费口径是每步的未缓存（input 减 cacheRead）、缓存、输出，再跨次取中位数。不把两步的 input 总数加在一起。B 的请求体会记是否包含技能目录。

`IUI_PERF_PROFILE_PATCH` 指向一份 `cordis.patch.yml` 时，脚本把它复制进临时 HOME 的 `fde-x` 和 `web` profile，跑完删除临时 HOME。日志走 `lib/redact.mjs`。

需要 Node 26 和 pnpm 11.20.0。实时跑还要本机 grok2api 在 `127.0.0.1:8000`。key 只放在环境变量 `GROK2API_API_KEY` 里，不要写进命令替换或文件。IUI 包只认环境变量 `FDE_IUI_ARTIFACT`。本分支没有 `scripts/pack/build-iui.mjs`。打包在分支 `cursor/iui-pack-pin-6fc8` 上，先 `pnpm install --frozen-lockfile`，再 `node scripts/pack/build-iui.mjs`。产物文件名形状是 `scripts/pack/.cache/iui-<commit>.tar.gz`。仓库没有发布这个包。期望的 commit、version 和 sha256 只读 `runtime/iui-pin.mjs`。这条分支不另写钉值。文件还没有时，命令说明需要先合 PR-9。这条 PR 必须排在 PR-9 之后合并。包内 `fde-plugin-pin.json` 的 commit 和 tar 的 sha256 都要和那份钉值一致。

没有 key 时，本机假 OpenAI 服务只拦请求。先拿到产物，再跑：

```bash
git clone --branch cursor/iui-pack-pin-6fc8 https://github.com/losebird/fde-x-desktop.git /tmp/fde-iui-pack
cd /tmp/fde-iui-pack
pnpm install --frozen-lockfile
node scripts/pack/build-iui.mjs
export FDE_IUI_ARTIFACT=/tmp/fde-iui-pack/scripts/pack/.cache/iui-<commit>.tar.gz
# 回到本测量分支的检出目录
node scripts/iui-perf/run.mjs --static
```

有 key 时，low 和 high 的 A/B 以及 B-default 各冷启动 3 次。脚本把 Host 的 baseURL 指到本机代理，再转发到 grok2api。Node 26。key 只留在环境变量里。

实时测量还要求本机已经有 fde-x profile 补丁。默认路径是 `$HOME/.dsh-fde-x/profiles/fde-x/cordis.patch.yml`。这是 FDE 的插件清单。没有这个文件时，脚本在启动时说明缺的是哪一个文件，以及怎么生成，而不是抛出裸的 ENOENT。`node runtime/server.mjs` 刚起来不会写这个文件。它在 `POST /api/v1/ai/connect` 时才出现。没有 `~/.dsh-fde-x/.credentials.yaml` 时 connect 返回 502，文件也不会出现。不要复制 `~/.dsh/.credentials.yaml`。密钥只放环境变量。不要设置 `FDE_DSH_HOME`。在默认家目录写一份空凭据再 connect：

```sh
set -eu
umask 077
mkdir -p "$HOME/.dsh-fde-x"
cred="$HOME/.dsh-fde-x/.credentials.yaml"
if [ ! -f "$cred" ]; then
  printf 'version: 1\nrefs:\n' > "$cred"
  chmod 600 "$cred"
fi
port="${FDE_RUNTIME_PORT:-4318}"
log="$HOME/.dsh-fde-x/fde-boot.log"
FDE_DATABASE_PATH="${FDE_DATABASE_PATH:-$HOME/.dsh-fde-x/fde.sqlite}" \
FDE_AI_WORKSPACE="${FDE_AI_WORKSPACE:-$HOME}" \
FDE_VENDOR_DIR="${FDE_VENDOR_DIR:-$HOME/.dsh-fde-x/missing-vendor}" \
FDE_SEMANTIC_RUNTIME_MODE="${FDE_SEMANTIC_RUNTIME_MODE:-readonly}" \
FDE_LISTEN_HOST=127.0.0.1 \
FDE_RUNTIME_PORT="$port" \
node runtime/server.mjs >"$log" 2>&1 &
echo $! > "$HOME/.dsh-fde-x/fde-server.pid"
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
curl -fsS -m 90 -X POST "http://127.0.0.1:${actual}/api/v1/ai/connect" \
  -H "origin: http://127.0.0.1:${actual}" \
  -H 'content-type: application/json' \
  -d '{}' >/dev/null
test -s "$HOME/.dsh-fde-x/profiles/fde-x/cordis.patch.yml"
```

```bash
git clone --branch cursor/iui-pack-pin-6fc8 https://github.com/losebird/fde-x-desktop.git /tmp/fde-iui-pack
cd /tmp/fde-iui-pack
pnpm install --frozen-lockfile
node scripts/pack/build-iui.mjs
export FDE_IUI_ARTIFACT=/tmp/fde-iui-pack/scripts/pack/.cache/iui-<commit>.tar.gz
# 回到本测量分支的检出目录
export GROK2API_API_KEY
IUI_PERF_PROFILE_PATCH="$HOME/.dsh-fde-x/profiles/fde-x/cordis.patch.yml" node scripts/iui-perf/run.mjs
```

`onFrame` 把对象传给 `activate(i)` 后读 `stops[i].day` 的桩 DOM 复现：

```bash
node --experimental-strip-types scripts/iui-perf/reproduce-onframe.mjs
```

需要 IUI 源码在 `IUI_SRC`（默认 `/tmp/iui-src`）。
