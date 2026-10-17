# IUI grok2api 首轮测量

同一句杭州三天提示。A 是裸 `@deepseek-ai/dsh` 0.2.0-rc.2 加 IUI `0.13.0-iui.26`（commit `c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37`），协议 `openai-completions`。B 是 fde-x 标准对话，协议 `openai-responses`。两边模型都是 `grok-4.6`。每次都是新的 HOME、新会话。

endpoint 读 `GROK2API_BASE_URL`，默认 `http://127.0.0.1:8000/v1`。key 只读 `GROK2API_API_KEY`，写进子进程环境，不写进 settings、凭证文件或请求日志。settings 里只记环境变量名 `apiKeyEnv`。

默认同时跑 effort `low` 和 `high`（`IUI_PERF_EFFORTS`，逗号分隔；不设就两组都跑）。对照臂 `B-default` 不写 `reasoningEffort`。每臂冷启动次数读 `IUI_PERF_RUNS`，默认 3。`--static` 时每臂 1 次。

汇总按组分开写中位数和波动，并把首 token 与生成耗时分开。计费口径是每步的未缓存（input 减 cacheRead）、缓存、输出，再跨次取中位数。不把两步的 input 总数加在一起。B 的请求体会记是否包含技能目录。

`IUI_PERF_PROFILE_PATCH` 指向一份 `cordis.patch.yml` 时，脚本把它复制进临时 HOME 的 `fde-x` 和 `web` profile，跑完删除临时 HOME。日志走 `lib/redact.mjs`。

需要 Node 26 和 pnpm 11.20.0。实时跑还要本机 grok2api 在 `127.0.0.1:8000`。key 只放在环境变量 `GROK2API_API_KEY` 里，不要写进命令替换或文件。IUI 包只认环境变量 `FDE_IUI_ARTIFACT`，指向现成的 `iui-c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37.tar.gz`。变量缺失或文件不存在时脚本退出并说明原因，不在这条分支上构建 IUI。`node scripts/iui-perf/run.mjs --help` 只打印用法。

没有 key 时，本机假 OpenAI 服务只拦请求：

```bash
node scripts/iui-perf/run.mjs --static
```

有 key 时，low 和 high 的 A/B 以及 B-default 各冷启动 3 次。脚本把 Host 的 baseURL 指到本机代理，再转发到 grok2api：

```bash
export GROK2API_API_KEY
IUI_PERF_PROFILE_PATCH="$HOME/.dsh-fde-x/profiles/fde-x/cordis.patch.yml" node scripts/iui-perf/run.mjs
```

`onFrame` 把对象传给 `activate(i)` 后读 `stops[i].day` 的桩 DOM 复现：

```bash
node --experimental-strip-types scripts/iui-perf/reproduce-onframe.mjs
```

需要 IUI 源码在 `IUI_SRC`（默认 `/tmp/iui-src`）。
