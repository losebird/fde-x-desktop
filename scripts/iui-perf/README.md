# IUI 首轮测量

同一句杭州三天提示，对比两组的首轮请求。A 是裸 `@deepseek-ai/dsh` 0.2.0-rc.2 加 IUI `0.13.0-iui.26`（commit `c5b5a4b7b9b5d39f541a796b9bb5e495f61c6c37`）。B 是 fde-x 标准对话，BFF 尽量绑在 4318，HOME 每次新建。

协议是 Anthropic Messages。脚本把 `DEEPSEEK_BASE_URL` 指到本机，记下 `POST /v1/messages` 的请求体。key 只读环境变量 `DEEPSEEK_API_KEY`，请求头里的 `x-api-key` 在落盘前抹掉。

需要 Node 26 和 pnpm 11.20.0。

没有 key 时，只做静态拦截：

```bash
node scripts/iui-perf/run.mjs --static
```

有 key 时，A 与 B 交替各跑 3 次，并写出对比表：

```bash
DEEPSEEK_API_KEY=... node scripts/iui-perf/run.mjs
```

静态结果在 `artifacts/iui-perf/static/comparison.md`。实时结果在 `artifacts/iui-perf/live/comparison.md`。首轮 system 全文和工具清单在同目录的 `first-turn/`。

静态表的 token 用 `js-tiktoken` 的 `o200k_base`。这不是 DeepSeek 的计费分词器。实时跑次的 input、output 和缓存命中来自上游 SSE 的 usage 字段。

`reading 'day'` 的构造复现：

```bash
node --experimental-strip-types scripts/iui-perf/reproduce-day.mjs
```

需要本机有 IUI 源码（`IUI_SRC`，默认 `/tmp/iui-src`）和 Playwright（`PLAYWRIGHT_ROOT`，默认 `/tmp/pw`）。
