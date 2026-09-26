# 05 · 业务记录：随 AI 操作自动浮现 + 增删改查审

依赖：01（事件）、04（本地实体也在此展示，可后接）。协议：`00-agent-protocol.md`。

## 1. 目标

业务应用「业务记录」Tab 不再是硬编码「采购单」的静态表，而是：AI 在会话里每做一次 `biz_preview` / `biz_write`，相关的表就浮现在这里（带「AI 刚查 / AI 拟改」标签）；用户可在页面上对业务数据做 现查 / 新建 / 改行 / 删除 / 过审，全部走 `biz_preview → 确认 → biz_write`；「操作控制」Tab 成为真正的审批与审计中心（`execute live` 接通）。支持多业务系统（连接器维度）。

## 2. 范围与禁区

- 做：`/state.pendingSheet` + `ai.tool.*` 事件驱动的浮现；型芯片来自 `biz_describe`；表格用 `sheet.columns`；行内动作四件 + 过审；`operations.execute live` → `biz_write`；`/biz/traces` 暴露；连接器分组（多业务系统）。
- 不做：绕过闸直写；在 SQLite 缓存业务行（只保留「最近浮现」的内存快照，刷新即失）；自定义报表。
- 禁区：lan-assist 源码不改；`translateBizIntent` 动作名闭集不改。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| 记录 Tab | `Data.tsx` L150–151、`RecordBrowser` L477–549：硬编码 `kind:'采购单'` L486–488、芯片死按钮 L509–511、来源列恒「现查」L541、列用动态 key L500–503 |
| 操作控制 | `Data.tsx` L153–160、`OperationControl` L552–673：默认 `record.update` L561、JSON 表单 L666–673；过账 L628–646（`bizWrite`） |
| BFF 闸 | `server.mjs`：`preview` L1701–1715（返回 `sheet{kind,action,rows,columns,preview_id,canWrite}`）、`catalog` L1718–1722（读 `lanAssist('/state')` 返回 JSON **顶层** `catalog` 数组，元素 `{name, speak, system, env, write, nod}`，见 lan-assist `catalog.js` `buildCatalog` L167+）、`write` L1781+（须 `preview_id`）、`lookup`（连接器登记） |
| **`biz_describe`（已核实）** | lan-assist **无**独立 HTTP 路径；等价 HTTP 为 `GET /catalog`（`http.js` L93–103 → `secretary.describeBiz`，返回 `{ok, kinds[], relations[], catalogVersion}`）。BFF `/biz/kinds` 走 `lanAssist('/catalog')`，白名单加 `/catalog` |
| traces | lan-assist `GET /traces`（`http.js` L105–115，rows: `id,kind,no,action,receipt_id,session_id`）；BFF 未暴露；`dsh-core.mjs` L668–671 白名单无 `/traces` |
| pendingSheet | lan-assist `/state` 含 `pendingSheet`/`pendingWrite`（`view.js` L310–311、L350–351；`gate.js` L143–150 AI preview 写入） |
| 工具事件 | `ai-stream.mjs` L46–85（规格 01 已发 `ai.tool.called`） |
| operations | `server.mjs` approve L2393–2410、execute L2413–2435（live 501）、POST plan L2438–2517（`plan_json='{}'`）；`db.mjs` `approveOperation` L507、`executeDryRun` L546 |
| 连接器 | `db.mjs` L252–272 `business_connections`（seed 仅 `lan-assist/pending`）；设置页 `biz/lookup` 登记 |
| 动作名 | `translateBizIntent` L132–173：现查 / 改行 / 新建 / 删除 / 过审 ↔ `record.*` |

## 4. 数据模型

无新业务表（业务真值在业务系统）。新增：

```sql
-- 007_biz_surface.sql
CREATE TABLE IF NOT EXISTS biz_surfaces (   -- 「最近浮现」历史，便于刷新后回看，非业务数据
  id TEXT PRIMARY KEY, workspace_cwd TEXT NOT NULL, connection_id TEXT, kind TEXT NOT NULL, action TEXT NOT NULL,
  preview_id TEXT, session_id TEXT, row_count INTEGER, columns_json TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biz_surfaces_ws ON biz_surfaces(workspace_cwd, created_at DESC);
```
`operations.plan_json` 开始写真实内容：`{ kind, action, previewId, sheetDigest, rows: [...ids], connectionId }`。`operation_steps` 补 INSERT：`preview` / `approve` / `write` / `receipt` 四步。

## 5. API 契约（`runtime/routes/biz.mjs`，把 `server.mjs` 的 `biz/*` 段 L1701–1790 迁入，行为不变）

| 路由 | 说明 |
|---|---|
| `GET /api/v1/biz/kinds?workspace&connection?` | `lanAssist('/catalog')`（`describeBiz`）→ `{ kinds:[{kind,label,fields[]}], relations[], catalogVersion }`；白名单加 `/catalog` |
| `GET /api/v1/biz/traces?workspace&limit=50` | 暴露 lan-assist `/traces`（白名单加 `/traces`），附 `receipt` |
| `GET /api/v1/biz/surfaces?workspace&limit=20` | 最近浮现列表 |
| `POST /api/v1/biz/preview` | 现有；成功后 **额外**：写 `biz_surfaces`、`emit('biz.sheet.pending', {kind,action,previewId,rows:len,columns,canWrite,source:'ui'})` |
| `POST /api/v1/biz/write` | 现有；成功后 `emit('biz.write.done')`；若关联 `operationId` 则推进 operation → `executed` + receipt step |
| `POST /api/v1/operations/:id/execute` | `execution_mode:'live'` 不再 501：校验 `approved` → 用 `plan_json.previewId` 调 `biz_write`（preview 过期则重新 preview 并要求再确认 → 409 `preview_expired`）|
| `GET /api/v1/biz/connections?workspace` | 现有 `listBusinessConnections` + 附 lan-assist `/state` 在线态、`catalogVersion` |

lan-assist state 轮询（BFF 内，规格 01 的指纹逻辑）：`pendingSheet` 指纹变化 → `emit('biz.sheet.pending', {…, source:'ai', sessionId})` + 写 `biz_surfaces`。

## 6. 前端契约

### 6.1 业务记录 Tab（改造 `RecordBrowser` → `src/components/biz/RecordsPanel.tsx`）

布局不变（顶部芯片 + 表格），内容变：
- **连接器选择**（芯片行最左，多业务系统时显示；单个时隐藏）：来自 `/biz/connections`。
- **型芯片**：来自 `/biz/kinds`，按连接器过滤；无连接 → Empty「先在设置登记业务连接器」。
- **浮现区**（表格上方一条）：订阅 `biz.sheet.pending`，显示最近一条「AI 刚查了 采购单 · 12 行 · 会话 X · 2 分钟前」/「AI 拟改 采购单 3 行 · 待确认」，点击 → 表格切到该 kind 并加载该 sheet（`rows` 从 lan-assist `/state.pendingSheet` 取或重新 `preview(现查)`）。历史用 `/biz/surfaces` 下拉。
- **表格**：列用 `sheet.columns[].label`（无 label 才用 key）；来源列 = 连接器名 + 「现查 hh:mm」；「AI 拟改」的 sheet 用现有强调色标行。
- **行内动作**（现有菜单样式）：改行 / 删除 / 过审 → `preview(action)` → 右侧抽屉展示 diff（preview 返回的 sheet）→「确认过账」→ `write(preview_id)` → 成功黄条 + 刷新现查；`canWrite=false` 时按钮禁用并 tooltip 闸原因。**新建** → 顶部按钮 → 表单（字段来自 `kinds[].fields`）→ preview(新建) → 确认 → write。
- **交给 AI**：选中行 → 「交给当前 AI」→ `promptAi` 带行摘要（用规格 07 上下文包 `entity`）。
- 本地应用实体（规格 04）：以「本地 · <应用名>」为连接器出现在选择器里，选中后渲染 `SpecTable`。

### 6.2 操作控制 Tab（改造 `OperationControl`）

- 列表：`operations` 按状态分组（待审批 / 已批准待执行 / 已执行 / 失败），每条显示 `plan_json` 的中文摘要（「改行 采购单 #PO-123 → 状态=已审」）而不是 JSON。
- 「批准」→ approve；「执行」→ execute live（有 preview 过期 409 时提示重新预览）；「撤销」→ 若 `compensations` 有记录则调补偿（本版只展示，无补偿 → 禁用）。
- 「新建操作」表单：动作下拉用中文闭集（现查/改行/新建/删除/过审），目标从「业务记录」选中行带入（`defaultTable`/`targetRef` 自动填），不再要求手写 JSON；高级模式保留 JSON。
- 审计时间线：`operation_steps` 四步 + receipt。

## 7. 错误与降级

- lan-assist 不在线：记录 Tab 顶部黄条「事务底座未就绪」，芯片来自上次 `kinds` 缓存（sessionStorage），动作全部禁用。
- preview 返回 `canWrite:false` / 无令牌：按钮禁用 + tooltip 原文。
- write 失败：红条含 lan-assist 返回 message；operation 标 `failed`，可重试。
- 多连接器但 lan-assist 只有一个 lookup：其它连接器显示「未登记」。

## 8. 验收清单

人工（5175；需 lan-assist 有一个可用词表工作区，否则用规格 04 的本地应用走 6.1 路径验证浮现机制）：
1. 芯片不再只有「采购单」，来自 `biz_describe`；无连接时 Empty 文案正确。
2. 在 AI 会话里说「现查采购单」→ 记录 Tab 浮现区 5s 内出现「AI 刚查了 采购单 · N 行」→ 点击 → 表格显示同一批行，列头是中文 label。
3. AI 说「把 PO-1 状态改成已审」→ 浮现「AI 拟改 · 待确认」→ 点开 diff 抽屉 →「确认过账」→ 成功 → `traces` 出现记录，操作控制里该 operation 为 `executed`。
4. 手动：选一行 → 改行 → 抽屉 → 确认 → 成功；无令牌时按钮禁用有 tooltip。
5. 操作控制：新建操作用中文动作下拉，目标自动带入；批准 → 执行 live 成功（不再 501）。
6. 刷新页面 → 浮现历史下拉仍有记录（`biz_surfaces`）。
7. 5174 回归：业务应用页原状。

自动化：`runtime/tests/biz.test.mjs`：`/kinds` `/traces` 转发与白名单；`biz_surfaces` 写入；`execute live` 状态机（approved→executed；未批准 409；preview 过期 409）；`operation_steps` 四步落库。

## 9. 提交拆分

1. `refactor(runtime): move biz routes to runtime/routes/biz.mjs (no behavior change)`
2. `feat(runtime): biz kinds/traces/surfaces + pendingSheet events`
3. `feat(runtime): operations execute live via biz_write; plan_json + steps`
4. `feat(web): RecordsPanel with connector/kind chips and AI surface strip`
5. `feat(web): row actions via preview→confirm→write; create form`
6. `feat(web): OperationControl approvals timeline + chinese action form`
7. `feat(web): local app entities in RecordsPanel`（依赖 04）

## 10. 开放问题

已关闭：`biz_describe` 的 HTTP 等价是 lan-assist `GET /catalog`（见 §3）。
