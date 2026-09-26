---
cursor:
  subagentId: "bc-ccdbb232-5f5f-5714-ac1e-f3ffaa335417"
---

# 产品缺口分诊 · `pnpm dev` 日常工作站（2026-09-17）

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**决策锚点**：`docs/project-context.md` 决策 **#14**（正式包装最后；本报告不排打包）。  
**证据**：`internal/wave1-review.md`、`wave1-accept.md`、`wave2-02-review.md`、`wave3-review.md`、`wave4-review.md`、`wave5-09-review.md`；本机只读 HTTP 探活（未重启 5174/4318）。

### 现网探活（本 triage）

| 端点 | 结果 |
|------|------|
| `GET http://127.0.0.1:5174/` | **200** |
| `GET http://127.0.0.1:4318/health` | **200**，`state: healthy` |
| `GET …/api/v1/ai/status`（Origin 5174） | **connected**，`dshHome: ~/.dsh-fde-x`，`lanPort: 19527` |
| `GET …/api/v1/im/state?cwd=…` | **200**，door/peers 有数据 |
| `GET …/api/v1/biz/kinds?workspace=…` | **503** `lan_assist_unavailable`（文案：「这封没绑工作区，不能打开目录。」） |
| `POST …/api/v1/context/pack`（`workspaceCwd` + `memory`） | **200**，`warnings: ["memory_query_missing"]` |

---

## 1. 日常能不能用

**能当「壳 + AI + IM 门」用，还不能当「全模块日更工作台」用。** 主栈 `pnpm dev`（5174/4318）在听，DSH 已连接，IM 状态接口正常，自动化底线（各 wave 审查里的 `tsc` / `smoke` / 大量 `node --test`）在代码侧多为绿。但 **业务记录依赖的 lan-assist `/catalog` 在主栈现网 503**，数据模块里的种类/痕迹/AI 浮现链路对 Ace 今天不可用；**记忆上下文包带 `memory_query_missing`**，语义检索/写入在「交给 AI」路径上降级。计划、应用、早报、MCP、整理待办等在 wave 3–4 已合入主干，却 **几乎没有 5174 上带截图的人工验收**（Playwright Chromium 多次「未对」），wave1-accept 还暴露计划列表/⌘K/IM 摘待办等 UI 证据缺口。因此：Ace 可以继续在 5174 聊 AI、看 IM，但 **不能诚实地把 记忆 / 计划 / 应用 / 早报 / 业务记录 / MCP 当已交付的日常能力**——缺的是「真坏了」的 biz 底座与记忆查询，以及整块 **未验收** 而非「代码不存在」。

---

## 2. 排序：下一批 Composer 可拥有切片（≤8）

每条标注：**真缺口** / **未验收** / **可延后**（本表仅列前两种；可延后见 §3）。

### 1) lan-assist 业务底座：`/biz/kinds` · `/biz/traces` 在主栈可用

| 字段 | 内容 |
|------|------|
| **类型** | **真缺口**（现网已证坏；wave4 在离线核心时亦 503，但本机 AI **已连接**仍 503） |
| **目标** | Ace 工作区下 `GET /api/v1/biz/kinds`、`/biz/traces` 返回 200 + 合规格数据；数据模块「业务记录」能拉 catalog/traces。 |
| **证据路径** | `internal/wave4-review.md` §05；`runtime/routes/biz.mjs` L122–144；本 triage curl 503 + 文案。 |
| **成功标准** | 5174 Origin + Ace 顶栏 cwd：`kinds`/`traces` **200**；`RecordsPanel` 能列出种类（截图）；`lan_assist_unavailable` 不再出现于此路径。 |
| **不要动什么** | 打包/Electron/DMG/CI stage；不新增路由/顶栏；不写 `biz_write` 绕过 preview。 |

### 2) 记忆：semantic 就绪 + `context/pack` 无 `memory_query_missing`

| 字段 | 内容 |
|------|------|
| **类型** | **真缺口**（主栈 pack 已警告）+ **未验收**（wave3 peer 上 `memory_engine_not_ready` 曾符合降级，但 Ace 主栈应达标） |
| **目标** | `POST /api/v1/context/pack` 含 `memory` scope 时无 `memory_query_missing`；Memory 页 ready/搜索/记档案路径可实测。 |
| **证据路径** | `internal/wave3-review.md` §07；`internal/facts-semantic.md`；本 triage pack 警告；`runtime/context-pack.mjs` / `dsh-core.mjs` semantic 白名单。 |
| **成功标准** | 主栈 `context/pack` **无** `memory_query_missing`；`GET /api/v1/memory/ready`（或等价）与 UI 绿条一致；规格 07 §9 至少 3 条人工步骤有截图。 |
| **不要动什么** | 不 restyle `Memory.tsx` 六画布；不接 packaging readonly 首启；不扩 `/python` 白名单除非规格 07 写明。 |

### 3) 5174 横切验收批（Wave 1–4 人工清单，非新功能）

| 字段 | 内容 |
|------|------|
| **类型** | **未验收** |
| **目标** | 按 `docs/specs/README.md` 完成定义，在 **5174 主栈**补「做了什么 → 看到什么」+ `files/media/wave*-ace/` 截图；区分真 bug vs 环境。 |
| **证据路径** | `internal/wave1-accept.md` §3–4；`wave3-review.md` / `wave4-review.md`「人工 UI 未对」；协议 `00-agent-protocol.md` §4 Playwright。 |
| **成功标准** | 01/03/08/04/05/06/07/08 各规格验收表 **无空白「未对」** 或协调器书面豁免；`npx tsc` + `node runtime/smoke.mjs` 仍绿。 |
| **不要动什么** | 不顺手改 UI 样式；不新开模块路由；验收失败项再单开代码 slice，本票只测只记。 |

### 4) 计划（SQLite + UI）：列表、工作区隔离、⌘K、IM 摘待办

| 字段 | 内容 |
|------|------|
| **类型** | **未验收**（wave1-accept：API/sqlite 有行，Playwright **未见**列表；⌘K 未命中；IM 摘待办未对） |
| **目标** | 规格 03 §8（除已 wave4 落地的整理待办）在 5174 可重复：新建任务持久化、切换工作区隔离、⌘K 搜任务、IM 摘成待办。 |
| **证据路径** | `internal/wave1-accept.md` §3 表 8.1–8.3、8.6；`wave1-review.md` §03；`src/pages/Plan.tsx`、`IMWorkspace.tsx`。 |
| **成功标准** | 同上四步截图 + sqlite/API 对照；若 UI 仍空则开 **真缺口** 子票修 hydrate/面板 mount，本 slice 先钉证据。 |
| **不要动什么** | 整理待办逻辑（已在 wave4-03）；不改 `defaultPanels`。 |

### 5) 业务记录（05）：lan-assist 在线后的浮现 · traces · 行内 CRUD

| 字段 | 内容 |
|------|------|
| **类型** | **未验收**（依赖切片 1）；代码侧 wave4 **已对** |
| **目标** | 规格 05 §8 人工 1–7：AI 浮现、traces、预览/写入令牌、`RecordsPanel` + `ContextChips`。 |
| **证据路径** | `internal/wave4-review.md` §05；`internal/wave4-05-biz.md`；`src/components/data/RecordsPanel.tsx`。 |
| **成功标准** | 切片 1 绿后，5174 走通 preview→人审→write；截图集齐；`biz_preview`/`biz_write` 无自动发 IM。 |
| **不要动什么** | 不把业务行缓存进 SQLite（仅 surfaces 元数据）；不复制 NocoBase 真值。 |

### 6) 早报（06）：定义 · 调度 · briefing agent + MCP 采集

| 字段 | 内容 |
|------|------|
| **类型** | **未验收** |
| **目标** | 自定义区块/源、调度 tick、MCP/RSS 类源经 `askAiForResult` 跑通一轮；无 BFF 原生出网（代码已核）。 |
| **证据路径** | `internal/wave4-review.md` §06；`internal/wave4-06-briefing.md`；`runtime/briefing/`、`Briefing.tsx`。 |
| **成功标准** | 规格 06 验收表人工项 + 至少一次定时/手动 run 截图；`imCompose` 仅进输入框。 |
| **不要动什么** | 不加 BFF HTTP 拉邮件/RSS；不 `imSend` 自动发。 |

### 7) 声明式应用（04）+ agent 动作（04 尾）：5174 Live 点击

| 字段 | 内容 |
|------|------|
| **类型** | **未验收**（wave3 agent defer → wave4 BFF/前端已落地，Live **未对**） |
| **目标** | 激活 spec 应用 → 表/表单 CRUD；`kind:agent` 行内动作触发 `askAiForResult` 且非 501。 |
| **证据路径** | `internal/wave3-review.md` §04 agent；`internal/wave4-04-agent-actions.md`；`runtime/routes/apps.mjs` agent 分支。 |
| **成功标准** | 5174 一套 fixture 或 Ace 真实应用截图；`apps.actions.test.mjs` 仍绿；确认 4318 已加载当前 `routes/apps.mjs`（若未加载只记「需重启」不杀 dev）。 |
| **不要动什么** | 不做 L2 Cordis 动态插件；`kind:biz` 表格 sheet UI 仍属范围外（wave4-04 已标）。 |

### 8) MCP：配置 server → 重载核心 → `tools` 投影非空

| 字段 | 内容 |
|------|------|
| **类型** | **未验收** |
| **目标** | 设置/MCP 页保存 streamable-http（或已有 server）→ 重载 AI 核心 → `GET /api/v1/mcp/servers` 的 v2 `tools` 为真实名而非长期 `[]`。 |
| **证据路径** | `internal/wave4-review.md` §08；`internal/wave1-accept.md` §08 7.6 细项未对；`runtime/routes/mcp.mjs`。 |
| **成功标准** | curl + UI 各一张；与 DSH 侧 MCP 列表一致；无 `mcp__name` 占位（单测已覆盖）。 |
| **不要动什么** | MCP 原地重连（规格外）；不改顶栏 MCP 模块。 |

---

### 模块速查（Ace 关心的八块）

| 模块 | 今天 | 归类 |
|------|------|------|
| **AI** | DSH connected；bridge/`askAiForResult` 代码在 main | **未验收**（5174 长会话、preset 专用会话、Host 工具实流） |
| **IM** | `im/state` 200 | **未验收**（摘待办、事件红点 wave1-accept 未全绿）；非证坏 |
| **记忆** | pack 有 `memory_query_missing` | **真缺口** + 未验收 |
| **计划** | BFF/SQLite 单测绿 | **未验收**（5174 UI/⌘K） |
| **应用** | 单测/smoke 绿 | **未验收**（5174 Live） |
| **早报** | 路由/调度代码在 | **未验收** |
| **业务记录** | `/biz/kinds` 503 | **真缺口** + 未验收 |
| **MCP** | API/UI 在；tools 未实测 | **未验收** |

**AI / 整理待办**：wave4-03 代码 **合并保留**，DSH happy path **未验收**——排在切片 3–4 之后、不单独占 rank（避免超 8 条）。

**事件总线**：wave1 must-fix 后 emit/Plan 订阅 **已对**（`wave1-accept.md`）；浏览器 SSE 曾有 403（`wave1-sse-403-fix.md` 已修 Referer 路径）。若 5174 仍见 EventSource 失败，先记 **未验收** 再决定是否单开 BFF 重启核对，不默认再改代码。

---

## 3. 本周明确不在范围（可延后）

按决策 **#14**，以下 **不排期、不派 Composer**：

- Electron / DMG / 签名 / `spctl` / 干净机首启（`internal/wave5-09-review.md` 全部 P1 验收 1–7）
- `scripts/pack/stage.mjs` 真 `@deepseek-ai/dsh` npm 树、NOTICE、GHA Release 出包（决策 #12 属打包轨）
- `window.fdeDesktop` / 桌面 picker 501 前端接线（打包壳问题，非 `pnpm dev` 主路径）
- Windows / Linux 安装包、semantic 1.8GB 首启 copy vs readonly 产品裁决（仅影响分发，不阻塞 5174 dev）
- UI restyle、新顶栏路由、L2 代码级应用

**Packaging 一词总结：本周只做「5174 上功能真能用 + 验收证据」，包装整轨搁置。**
