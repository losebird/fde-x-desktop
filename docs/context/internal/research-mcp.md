# FDE-X：MCP 连业务 vs lan-assist 过账闸（只读评估）

## 1. 现状

- **MCP 进 DSH 的路径**：4318 `POST /api/v1/mcp/servers` 向 `runtime/dsh-core.patch.yml`（`FDE_DSH_PATCH`，默认 `runtime/dsh-core.mjs` L143、`server.mjs` L78）**追加** Cordis 插件块：`package: @deepseek-ai/dsh-mcp-client`、`transport: stdio`、`command/args`（`server.mjs` L2218–2240）。`dsh-core.patch.yml` 基座只有 credentials/会话/禁用官方 UI + `fde-x-dsh-bridge`（L1–36），**不含**预置 MCP。
- **DSH 启动**：`dsh-core.mjs` L241–245 `dsh web --profile … --patch <patchFile>`；MCP 实例随 **核心进程启动** 加载，非 4318 内存态。
- **保存后重载**：已连接时 `stop()`+`start()`（L2241–2245）；否则 `needsRestart` + MCP 页提示「设置 → AI 核心 → 重载核心」（`MCP.tsx` L165–167、L188–189）。规格 §0.5 L76、§15.6 L522、`HANDOFF` §4.7 L136、`PRODUCTION-STATUS` L17/L30：无 MCP Remote，**不能**会话内热加载。
- **启停 disabled**：`MCP.tsx` L117–125 `disabled` + `title="启停需重连本地核心"`；与 Skills 同规（`HANDOFF` §4.7 L137），无 DSH 按 server 启停 Remote。
- **业务过账与 MCP 分离**：架构图 `PRODUCTION-SPEC` L111–118：`/api/v1/biz/*` → `lanAssist`；MCP 走 DSH patch。`server.mjs` L1682–1770：`preview`→`/preview`、`write`→`/write`（须 `preview_id` L1764–1768）；`lookup/catalog` 亦 lan-assist。AI 侧业务工具来自 **lan-assist 插件**（`view.js` L252–253 `biz_preview`/`biz_write`），**不是** `mcp__*`。UI 过账 `Data.tsx` L628–646、`L680` 人点「确认过账」。**对：业务写/现查闸与 MCP 配置无代码耦合；错：AI 仍可通过 DSH 直接调 `biz_write`（经 lan-assist 闸），非 MCP 通道。**

## 2. DSH MCP 能力边界

- **传输**：`dsh-mcp-client/README.zh.md` L55–60、`lib/index.js` L42–48 — 仅 **`stdio`**、**`streamable-http`**（`url`+`headers`）；无 SSE 旧 HTTP 别名说明。
- **配置**：Cordis YAML 每 server 一条 `id`+`config.serverName`（`[A-Za-z0-9_-]{1,32}` 全局唯一，`README.zh.md` L77–78）；工具名 `mcp__<serverName>__<tool>`（L74）。
- **热加载**：插件文档 L92 — **编辑配置项可原地重连**；FDE-X 未接 DSH 动态配置 API，只 append patch + 整进程重启（`PRODUCTION-STATUS` L17）。
- **按会话启用**：无；MCP 为 harness 级，非 per-session（`PRODUCTION-SPEC` §15.6 L522「与当前会话工具列表无关」）。
- **Host 审批**：MCP 工具注册为**原生工具**，走 DSH 权限档 + `approval/request`（规格 §0.5 L70–84、L84）；**无** MCP 专用二次闸。`dsh-mcp-client` 不校验业务 `preview_id`（L12 仅桥接 tools）。

## 3. 架构候选（对照铁律：SQLite≠ERP、`write.js` L774–779 无令牌必拒、人确认过账 `Data.tsx` L680）

| 方案 | 优 | 劣/风险 | 主要触点 |
|---|---|---|---|
| **A** 业务各自 MCP 挂 DSH，AI 直调 | 集成快 | **绕过** preview 令牌/指纹/审批；违反 `HANDOFF` §4.6 L129、`PRODUCTION-SPEC` L99 | 任意 `dsh-core.patch.yml` 追加写工具 |
| **B** MCP 只读，写走 biz_preview→人→biz_write | 读可复用 MCP 生态 | **现查**规格要求仍走 `biz_preview`（`catalog.js` L267、`gate.js` L128–151）；双通道易漂移 | MCP 页禁写类工具；AI prompt 仍靠 lan-assist |
| **C** lan-assist/BFF 包成 MCP 或 UI 统一「业务连接器」 | **写路径不变**（`gate.js` L118–217 preview、`L219–271` write）；MCP 页可展示 catalog+闸工具 | 需新网关或官方 MCP 暴露；开发量中 | `server.mjs` biz 路由、`MCP.tsx`、`Settings` 连接器区（§10 L382） |

**最合理：C（产品面）+ 非 ERP 通用 MCP 仍走 A 的子集但标「非业务写」**。业务数据**禁止** A；B 仅作外部只读辅助，**不能**替代 `biz_preview` 现查。

## 4. MCP 页 / 设置页（不新页）承担「业务连接器管理」

- **连接状态**：`GET /mcp/servers` 现仅 regex `serverName`+假 tools（`server.mjs` L2206–2212）→ 应合并 `lanAssist /state` catalog（L1700–1702）与 DSH `session/control` 工具投影；卡片分 **「MCP 服务器」|「业务连接器（lan-assist）」**（`MCP.tsx` L84–85 空态文案可复用）。
- **工具清单**：连接后拉真实 `mcp__*` 列表，非占位 `mcp__name`（L2212）；业务侧列 `biz_preview`/`biz_write`/…（`view.js` L252–253）。
- **权限**：MCP 表单项增 `transport`/`url`（对齐 README L55–60）；业务连接器只读展示 + 跳转 **设置·存储与数据** lookup（§10 L382、`server.mjs` L1716–1758）；写能力仅 **操作控制** + 令牌 UI（`Data.tsx` L669–726）。
- **健康检查**：stdio 进程/HTTP ping（4318 新只读路由）；lan-assist `GET /state` + `biz_describe` 三态（§0.5 L88–89）。
- **重载提示**：保存后全局 banner + 链到 `CoreSettings.tsx` L87–97 `POST /api/v1/ai/reload`（`server.mjs` L1034）；列表 Tag「需重载」（§15.6 L522）。

## 5. 结论与第一步

**结论**：「MCP 连业务」若指 **ERP 写/现查**，应 **强化 lan-assist 闸 + UI 统一展示**，而非把 NocoBase 写工具挂进 `dsh-mcp-client`；MCP 页管 **通用工具服务器**，业务连接器与 lookup 在设置登记、在 MCP/业务应用看状态。

**第一步（可落地、不改闸语义）**：设计并实现 `GET /api/v1/mcp/servers` v2——合并 patch 内 MCP 条目 + lan-assist catalog/连接态 +（可选）DSH 工具枚举；`MCP.tsx` 分区渲染与健康 Tag，保存仍写 patch 并强制「重载核心」链路。
