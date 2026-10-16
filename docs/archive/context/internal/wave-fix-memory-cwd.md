---
cursor:
  subagentId: "bc-e87917be-260d-58aa-a7e8-4cc28bd9bf20"
---

# Wave fix · `memory/search` · `CWD_NOT_AUTHORIZED`

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**结论**：**配置缺口**（DSH `workspaceAuthority` 未收录场景 cwd）。**无 BFF 代码提交**。

## 现象（重启前主栈，Ace 已记录）

| 检查 | 结果 |
|------|------|
| `GET /api/v1/memory/ready` | `ready: true` |
| `GET /api/v1/memory/search?q=…&cwd=<scene-39 绝对路径>` | **502**，message **`CWD_NOT_AUTHORIZED`**（经 BFF `AiRemoteError` → 502） |
| 重启后（本 agent 未复验 search） | `GET /api/v1/ai/status` **`connected: false`** → search **503 `ai/not-connected`**（与 cwd 诊断无关） |

## 链路（已对：代码出处）

| 环节 | 行为 | 出处 |
|------|------|------|
| BFF 取 cwd | `requestMemoryCwd(url)`：`body.cwd` 或 query **`cwd`**（仅 `cwd`，无 `workspace` 别名） | `runtime/server.mjs` L125–129 |
| BFF search | `semanticOs('/find', { query, ...(cwd ? { cwd } : {}) })` | `server.mjs` L1742–1746 |
| cwd 为空时 | `semanticCwd(options, this.cwd)` 回落 **`FDE_AI_WORKSPACE`**（connector `this.cwd`） | `dsh-core.mjs` L239–242、L822–835 |
| 上游 /find | `body.cwd \|\| x-dsh-cwd` → `authorize(cwd)` | `~/.dsh/vendor/dsh-semantic-os/product.js` L1195–1198 |
| 授权 | `workspaceAuthority.allows(canonical(cwd))`：live `sessions.list()` 或 `persistence.list()` 里 **canonical cwd 完全相等** | `workspace-authority.js` L44–53 |

前端 `searchMemory` 经 `withWorkspaceCwd` 带 **`?cwd=`**（`src/lib/runtime-api.ts` L12–15、L1235），与规格 07 connector §4.2「`cwd` 走 `?cwd=`」一致。context pack 的 `fillMemory` 直接把 `workspaceCwd` 传给 `semanticFind`（`context-pack.mjs` L215）。**未发现 BFF 丢弃、改写成非工作区路径或漏传 header/body cwd 的 bug。**

## 根因（仍差：环境，非本仓库补丁）

FDE 运行时默认 **`FDE_DSH_HOME` → `~/.dsh-fde-x`**（`runtime/config.mjs` L21），semantic-os 的 `workspaceAuthority` 只看 **该 DSH home 下** 的会话持久化与当前 live sessions。

本机静态核对（2026-09-17，未依赖重启后 search）：

| 路径 | 是否含 scene-39 cwd |
|------|---------------------|
| `~/.dsh-fde-x/storages/session_projcache/sessions/*.json` 的 `record.identity.cwd` | **否**（多为 `fdex测试`、`semantica`、`kimi-project/…/工作台宣传图` 等） |
| `~/.dsh-fde-x/lan-assist/state.json` 的 `workspace` 字段 | **有** scene-39 路径（IM 状态，**不**参与 `workspaceAuthority`) |
| `~/.dsh/storages/session_projcache/sessions/*.json` | **有** 多条 scene-39（官方 `~/.dsh` home，**与 fde-x 隔离栈无关**） |

因此：BFF 把 **正确的** scene 绝对路径交给 `/find` 时，semantic 仍返回 **`CWD_NOT_AUTHORIZED`**，因为 **fde-x 栈从未在该 cwd 下登记过 DSH 会话**（authority 无 allowlist 文件可改；禁止在 BFF 侧绕过 `authorize(cwd)`）。

## Ace 要做的（配置，不是改 whitelist /python）

1. 在 **4318 已 `connected: true`** 时，于 **同一 `FDE_DSH_HOME`（默认 `~/.dsh-fde-x`）** 下，在目录  
   `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
   **打开/创建一条 DSH Agent 会话**（与平时用 AI 页一致），使 `workspaceAuthority` 的 live sessions 或 persistence 列表出现该 **canonical cwd**。
2. 验收：在 `~/.dsh-fde-x/storages/session_projcache/sessions/` 新增或更新会话 JSON，`record.identity.cwd`（或 list 适配后的 `header.cwd`）等于上述路径。
3. 再 `curl`  
   `GET /api/v1/memory/search?q=test&cwd=/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
   （`Origin: http://127.0.0.1:5174`）——期望 **非** `CWD_NOT_AUTHORIZED`（仍可能因索引空而 items 为空）。
4. **不要** 为 cwd 问题改 `FDE_DSH_HOME` 指到 `~/.dsh` 除非有意合并两套会话数据；**不要** 在 BFF 禁用 semantic authorize 或扩 `/python` 白名单。

## 可选一致化（非本票阻断）

`resolveBizWorkspace` 接受 query `workspace` **或** `cwd`（`biz.mjs` L85–90），`requestMemoryCwd` 仅 `cwd`。规格 07 已写 memory 用 `?cwd=`；仅当手工探针误用 `?workspace=` 时会落空并回落 `FDE_AI_WORKSPACE`——与当前 **显式 cwd 仍 403** 的主因无关。

## 代码动作

- **无 commit**（诊断结论：非 BFF cwd 传递 bug）。
- 重启后 **503** 待 Ace 恢复 `ai/status connected: true` 后再做 search 复验；本 agent **未 recycle 4318、未起新 DSH**。

## 母体对照（本票）

| 项 | 母体 / 规格 | fdex | 实测 |
|----|-------------|------|------|
| search 带 cwd | 07 connector §4.2 `?cwd=` | `withWorkspaceCwd` + `requestMemoryCwd` | 已对（代码） |
| semantic authorize | `workspaceAuthority.allows` | 同上游 | 重启前：**仍差** scene cwd 未进 fde-x 会话表 |
| 重启后 search | — | — | **现网未测**（`connected: false`） |
