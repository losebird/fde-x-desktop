---
cursor:
  subagentId: "bc-4ea4ebd6-5d99-5cd8-a63a-173a66e75471"
---

# Wave fix · biz catalog / traces（slice 1）

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**时间**：2026-09-17

## 根因（已对）

| 层 | 证据 |
|---|---|
| **dsh-lan-assist** | `http.js` L93–102：`GET /catalog` → `secretary.describeBiz({ workspace: url.searchParams.get('workspace') })`；`secretary.js` L490–492：无 `workspace` → `{ ok:false, error:'NO_CWD', hint:'这封没绑工作区，不能打开目录。' }`，HTTP **400**。 |
| **BFF 误参** | `runtime/routes/biz.mjs` 原 L124：`lanAssist('/catalog', { search: { sessionId: '' } })`；`dsh-core.mjs` L849–851 空 `sessionId` 不入 query → lan-assist **收不到 workspace**。 |
| **错误码映射** | `lanAssist` 对 HTTP 400 抛 `AiRemoteError`（message = hint）；`biz.mjs` catch → `503 lan_assist_unavailable` + 上述 hint → **像「没绑工作区」**，实为 **BFF 未传 workspace**，非 lan-assist 宕机。 |
| **traces** | 同模式：`/traces` 需 `workspace`（`secretary.openTrace` L446–448），原仅传 `limit`。 |

**未对（修前现网）**：`GET :5174/api/v1/biz/kinds` → 503 `lan_assist_unavailable`（message 为 NO_CWD hint）。

**旁证（DSH 直连，修前参数正确即 200）**：

```bash
curl "http://127.0.0.1:57764/lan-assist/catalog?workspace=<scene-39-personal-workstation 绝对路径>"
# → 200，kinds 数组非空
```

`GET /api/v1/ai/status`：**connected**，`lanPort: 19527` — 与 triage 一致，排除「核心未连」假因。

## 改动（已对）

| 文件 | 内容 |
|---|---|
| `runtime/routes/biz.mjs` | `resolveBizWorkspace(url, aiRuntime)`：`workspace`/`cwd` query → `aiRuntime.cwd` → `FDE_AI_WORKSPACE`；`/biz/kinds`、`/biz/traces` 向 lan-assist 传 `search.workspace`。 |
| `runtime/tests/biz.test.mjs` | 断言 kinds/traces 走 `workspace`，不再 `/catalog` + `sessionId`。 |

**仍差**：未改 `dsh-core.mjs`（白名单已含 `/catalog`、`/traces`）；未 restyle；未加路由。

## 验证

| 项 | 结果 |
|---|---|
| `node --test runtime/tests/biz.test.mjs` | **7/7** |
| 修后 **未重启 4318** 时 `curl :4318/api/v1/biz/kinds` | **仍 503**（旧进程）— **Ace 须重启主栈** 后 BFF 才加载 `biz.mjs`。 |
| 重启后预期 | `GET :5174/api/v1/biz/kinds`、`/api/v1/biz/traces?limit=50` → **200** + `data.kinds` / `data.rows`；`lan_assist_unavailable` 在此路径消失；`RecordsPanel` `listBizKinds()` 可列种类。 |

## Commit

```
fix(biz): restore lan-assist catalog on main stack
```

仅 stage：`runtime/routes/biz.mjs`、`runtime/tests/biz.test.mjs`。

## 对照表（slice 1 最小行）

| 项 | 母体 / 规格 | fdex / 本栈 | 状态 |
|---|---|---|---|
| `/biz/kinds` 参数 | dsh-lan-assist `workspace` query | `biz.mjs` `resolveBizWorkspace` + `search.workspace` | **已对**（代码）；**现网未测**（待重启） |
| `/biz/traces` 参数 | 同上 | 同上 + `limit` | **已对**（代码）；**现网未测** |
| 503 文案 | NO_CWD hint（IM 语境） | 修前误当 lan_assist 离线 | **仍差**语义（修后应不再触发此路径） |
| RecordsPanel | `listBizKinds()` 无 query | 依赖 BFF 默认 cwd | **未对** UI 截图 |
