---
cursor:
  subagentId: "bc-510924d7-645a-5f9f-9f14-e942ff376fbc"
---

# wave-fix · fdex测试1 · biz NO_VOCAB / 空目录

**时间**：2026-09-17  
**栈**：5174 BFF · DSH `~/.dsh-fde-x` · 顶栏 cwd `/Users/zxz/Documents/ai-project/fdex测试`  
**截图**：[ace-biz-novocab.png](../media/ace-biz-novocab.png)

## 结论（给 Ace）

| 路径 | 用的 workspace cwd | 现象 |
|------|-------------------|------|
| **DSH 工具** `biz_describe` / `biz_preview` | `session.header.cwd` = 顶栏 fdex测试 | `describeBiz` → kinds **[]**；`preview` 工单 → **NO_VOCAB**（与截图一致） |
| **BFF** `GET /biz/kinds`（无 `cwd`） | `aiRuntime.cwd` = **scene-39**（`GET /api/v1/ai/status` 的 `workspace`） | **41** kinds，含「工单」——**不是**顶栏目录 |
| **BFF** `GET /biz/kinds?cwd=<fdex>` | 显式 fdex | kinds **[]**（与 DSH 一致） |
| **BFF** `POST /biz/preview`（改前） | `translateBizIntent` 固定 `aiRuntime.cwd` = scene-39；`body.cwd` 只写 `biz_surfaces` | 即带 `cwd: fdex` 仍用 scene-39 词表现查（curl 已证实） |

**根因拆两条：**

1. **代码（已修）**：BFF / 前端未把顶栏 cwd 送进 lan-assist 的 `/catalog` 与 preview `workspace` 槽，裸调 kinds/preview 会误用 scene-39。提交：`0ef448b` `fix(biz): pass active workspace cwd to lan-assist`（`runtime/routes/biz.mjs` + `src/lib/runtime-api.ts`）。**需 BFF 进程重载后** curl/UI 才体现；本票未杀 pnpm。
2. **数据 / 语义仓（Ace）**：磁盘上 **已有** `fdex测试/.dsh/semantic-os/graph.json`，其中 `skos:Concept` `#ticket` 的 `content: 工单`、`resource: biz_tickets`、fields/can 齐全；但 **运行中** `lan-assist → semantic.vocab(fdex)` 仍得到 **0** 条可登记型 → gate **NO_VOCAB**。不是「目录里完全没有词表文件」，是 **语义侧未把该 cwd 的图供给 lan-assist**（或 `list_graph_nodes` 对该 cwd 空/失败）。**不要**从 NocoBase 刮进 SQLite；应在 **该 cwd** 走既有 **catalog/publish / 语义 ingest** 链路，直到 `GET /api/v1/biz/kinds?cwd=<fdex>` 出现「工单」。

**RecordsPanel 空**：在 preview 失败、无 `biz_surfaces` 浮现时符合预期；**不要**恢复成全库 catalog 浏览器。

**连接器**：`business_connections` 仍只在 `ws_personal`；与本次 NO_VOCAB 无直接关系（lookup 全局，词表按 **cwd** 分仓）。

---

## curl 复现（5174，`Origin: http://127.0.0.1:5174`）

```bash
SCENE="/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation"
FDEX="/Users/zxz/Documents/ai-project/fdex测试"
H='Origin: http://127.0.0.1:5174'

# kinds
curl -sS -H "$H" "http://127.0.0.1:5174/api/v1/biz/kinds" | jq '.data.kinds | length'          # → 41（scene-39 默认）
curl -sS -H "$H" "http://127.0.0.1:5174/api/v1/biz/kinds?cwd=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FDEX'))")" | jq '.data.kinds | length'  # → 0

# preview 工单（改前：body.cwd=fdex 仍走 scene-39，ok:true）
curl -sS -H "$H" -H 'Content-Type: application/json' -X POST http://127.0.0.1:5174/api/v1/biz/preview \
  -d "{\"kind\":\"工单\",\"action\":\"现查\",\"cwd\":\"$FDEX\",\"where\":[]}" | jq '.data.ok, .data.error'

# memory 授权对照（fdex 已授权，scene-39 未授权）
curl -sS -H "$H" "http://127.0.0.1:5174/api/v1/memory/search?q=test&cwd=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$FDEX'))")" | jq '.data.ok // .error.code'
curl -sS -H "$H" "http://127.0.0.1:5174/api/v1/memory/search?q=test&cwd=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$SCENE'))")" | jq '.error.code'
```

**改后预期**（BFF 重载 + 顶栏选 fdex）：`POST /biz/preview` 带顶栏 `cwd` 时 `workspace` 进 lan-assist 为 fdex → 与 DSH 工具同为 **NO_VOCAB**，直到 kinds 非空。

---

## 代码接点（fdex 源码树）

| 接点 | 行为 |
|------|------|
| `dsh-lan-assist/tools.js` `toolWorkspace(exec)` | `agent.session.header.cwd` |
| `dsh-lan-assist/secretary.js` `describeBiz` / `loadVocab` | `workspace` → `semantic.vocab(cwd)` |
| `dsh-lan-assist/index.js` `loadWorkspaceVocab` | `found.ok === false` → throw **NO_VOCAB** |
| `runtime/routes/biz.mjs` `resolveActiveBizCwd` | query/body `cwd` 优先，再回落 `aiRuntime.cwd` |
| `src/lib/runtime-api.ts` | `withWorkspaceCwd` / `workspaceCwdBody` 用于 kinds、traces、preview |

---

## Ace 动作清单（未改数据）

1. BFF 热重载或等下次重启，拉取 `cursor/fix-biz-lan-assist-cwd-6fbc`（或含 `0ef448b` 的分支）。
2. 在 **fdex测试** 顶栏下确认：`GET /api/v1/biz/kinds?cwd=<顶栏 path>` 是否出现「工单」；仍为 0 → 在 **该 cwd** 用 UI/流程 **发布或刷新语义词表**（`POST /api/v1/biz/catalog` → lan-assist `/catalog/publish`，或 semantic-os ingest 使 `list_graph_nodes` 有 `skos:Concept`），**不要**手造 SQLite、不要刮 NocoBase。
3. kinds 非空后再测 AI「2026 未完成工单」`biz_preview`；RecordsPanel 应靠 preview / `biz_surfaces`，非 kinds 芯片当目录浏览器。

## 相关

- [workspace-identity-map.md](./workspace-identity-map.md)
- [docs/specs/05-business-records.md](../docs/specs/05-business-records.md)

已上 main `75605f3`（cherry-pick from `0ef448b`）
