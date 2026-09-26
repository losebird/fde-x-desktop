---
cursor:
  subagentId: "bc-e7194b0a-b03d-5c38-b5e5-62dd0aa618c3"
---

# Wave fix · `memory_query_missing` on context pack

**代码**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**提交**：`74a299a` — `fix(memory): restore semantic query on context pack`  
**改动文件**：`runtime/context-pack.mjs`，`runtime/tests/context-pack.test.mjs`

## 诊断

| 假设 | 结论 | 证据 |
|------|------|------|
| semantic 未就绪 | **否** | 主栈 `GET /api/v1/memory/ready` → `ready: true`；`GET /api/v1/ai/status` → `connected: true`（本机 2026-09-17） |
| pack 未带查询工具 / 白名单缺 op | **否**（有 query 时会调） | `dsh-core.mjs` L765–775 已放行 `find_precedents`、`brief_for_decision`；`/find` 走 L822–841 |
| 探针缺 `query` | **是（主因 `memory_query_missing`）** | `product-gap-triage` 仅 `scopes:["memory"]` + `workspaceCwd` → `fillMemory` 在 `buildMemoryQuery` 为空时 `warnings.push('memory_query_missing')`（`context-pack.mjs` L205–208） |
| 语义 cwd 授权 | **仍差（`memory_find_failed`，非本票警告）** | 同栈 `GET /api/v1/memory/search?...` → **502** `CWD_NOT_AUTHORIZED`；带 `query` 的 pack 出现 `memory_find_failed` / `memory_precedents_failed`，与 triage 探针的 `memory_query_missing` 不同 |

规格 07 §4.2：`memory` 需要 `query`（由 intent + entity 拼）。产品路径（IM / `askAiForResult` / 业务行 `entity`）本来会带字段；**仅 memory scope 的健康检查探针**在 semantic 已就绪时仍会误报 `memory_query_missing`。

## 修复（最小）

`buildMemoryQuery` 在 `query` / `entity` / `intentKind` 皆空时，用 **`folderName(workspaceCwd)`** 作环境召回串（与 pack 里工作区名一致），再走 `/find` + `find_precedents`。

## 验证

| 检查 | 结果 |
|------|------|
| `node --test runtime/tests/context-pack.test.mjs` | **4/4**（含新用例「无 query 时用目录名」） |
| `curl` 4318 pack（改后） | **需 Ace 重启主栈 BFF** 后复验；本 agent 未 recycle 4318 |
| 改前现网 curl（memory only） | `warnings: ["memory_query_missing"]`（`Origin: http://127.0.0.1:5174`） |
| 改前 + `query` | 无 `memory_query_missing`，但有 `memory_find_failed`（cwd 授权，见上） |
| 规格 07 §9 UI  walk | **未做**（无截图；不声称 Memory UI 已验收） |

## 复验命令（Ace 重启 4318 后）

```bash
curl -sS -X POST http://127.0.0.1:4318/api/v1/context/pack \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://127.0.0.1:5174' \
  -d '{"workspaceCwd":"/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation","scopes":["memory"]}'
```

期望：`data.memory` 存在，**无** `memory_query_missing`（仍可能有 `memory_find_failed` 直至 DSH `workspaceAuthority` 允许该 cwd）。

## 母体对照（本票范围）

| 项 | 母体 / 规格 | fdex | 实测 |
|----|-------------|------|------|
| pack memory 查询串 | 07 §4.2 intent+entity+query | `buildMemoryQuery` + 目录名回落 | 单测已对；4318 现网未测（待重启） |
| `memory_query_missing` | 不应在「仅 memory scope」探针误报 | 已改 | 待 Ace curl |
| Memory UI §9 | 07 §9 1–8 | 未 walk | 未验收 |
| `/find` 现网 | semantic-os `authorize(cwd)` | `CWD_NOT_AUTHORIZED` on 本机 search | **仍差**（环境/授权，非本 commit 范围） |
