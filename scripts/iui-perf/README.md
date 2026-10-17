# IUI grok2api 首轮测量

同一句杭州三天提示。A 是裸 `@deepseek-ai/dsh` 0.2.0-rc.2 加 IUI `0.13.0-iui.26`（commit `c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37`），协议 `openai-completions`。B 是 fde-x 标准对话，协议 `openai-responses`。两边模型都是 `grok-4.6`。每次都是新的 HOME、新会话。

endpoint 读 `GROK2API_BASE_URL`，默认 `http://127.0.0.1:8000/v1`。key 只读 `GROK2API_API_KEY`，写进子进程环境，不写进 settings、凭证文件或请求日志。settings 里只记环境变量名 `apiKeyEnv`。

对齐组的 effort 读 `GROK2API_EFFORT`，默认 `low`，A 和 B 设成同一个值。对照臂 `B-default` 不写 `reasoningEffort`，让 fde 自己的 seal（自定义模型 `reasoningEfforts: false`）决定请求里有没有 effort。

需要 Node 26 和 pnpm 11.20.0。

没有 key 时，本机假 OpenAI 服务只拦请求，各臂 1 次：

```bash
node scripts/iui-perf/run.mjs --static
```

有 key 时，A、B、B-default 各冷启动 3 次。脚本把 Host 的 baseURL 指到本机代理，再转发到 grok2api，记下每步的 input、output、cacheRead、首 token 和耗时：

```bash
GROK2API_API_KEY=... node scripts/iui-perf/run.mjs
```

`onFrame` 把对象传给 `activate(i)` 后读 `stops[i].day` 的桩 DOM 复现：

```bash
node --experimental-strip-types scripts/iui-perf/reproduce-onframe.mjs
```

需要 IUI 源码在 `IUI_SRC`（默认 `/tmp/iui-src`）。
