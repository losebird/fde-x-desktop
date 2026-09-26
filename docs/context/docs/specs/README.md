# FDE-X 工作台 · 可执行规格包

给 coding agent 直接执行的规格。每份规格自成一体：目标 / 范围与禁区 / 现有代码接点（文件 + 行号）/ 数据模型原文 / API 契约 / 前端契约 / 错误与降级 / 验收清单（人工 + 自动化）/ 提交拆分 / 开放问题。所有规格默认包含 [00 · Agent 执行协议](00-agent-protocol.md)。

背景与决策：[项目上下文](../project-context.md)、[平台方案](../platform-design.md)、[打包方案](../packaging-design.md)。

## 规格清单与依赖

| # | 规格 | 依赖 | 被依赖 | 量级 |
|---|---|---|---|---|
| 00 | [Agent 执行协议](00-agent-protocol.md) | — | 全部 | — |
| 01 | [事件总线](01-event-bus.md) | — | 02 04 05 06 07 | S |
| 02 | [FDE Host 工具集 + askAiForResult](02-bridge-tools.md) | 01 | 03 04 06 07 08 | M |
| 03 | [计划接 SQLite](03-plan-sqlite.md) | 01（可选）02（整理待办） | 06 07 | M |
| 04 | [声明式应用运行时](04-app-spec-runtime.md) | 01 02 | 05 06 07 | XL |
| 05 | [业务记录浮现 + 增删改查审](05-business-records.md) | 01（04 可后接） | 06 | L |
| 06 | [可自定义早报 + 外部源](06-briefing.md) | 01 02 03（07 可后接） | — | L |
| 07 | [记忆连接层](07-memory-connector.md) | 01 02 | 03–06 的接入点 | L |
| 08 | [preset 导入 + MCP 连接器视图](08-preset-import.md) | 02 | — | M |
| 09 | [Electron 单包分发](09-electron-packaging.md) | config.mjs（已落地） | — | XL |

## 执行顺序（建议）

```
波次 1（并行）：01 事件总线 ｜ 03 计划接 SQLite（不含「整理待办」）｜ 08 preset 导入（不含 MCP v2 的 tools 投影）
波次 2：02 bridge 工具 + askAiForResult（依赖 01）
波次 3（并行）：04 应用运行时 ｜ 07 记忆连接层
波次 4（并行）：05 业务记录（含接入本地实体）｜ 06 早报（依赖 02 03 07）｜ 03/08 补尾（整理待办、MCP tools 投影）
波次 5：09 Electron P1 mac POC（§10 提交 1–5 可从波次 3 起并行）→ P2 Windows
```

并行规则（勘误后）：
- 同一波次内的规格**不共享业务文件**。已知重叠与处置：04 与 05 都改 `Data.tsx` / `db.mjs` / `server.mjs` biz 段 → **05 移到波次 4**（上表已改）；06 改 `Briefing.tsx`，03 补尾改 `Plan.tsx`/`IMWorkspace.tsx`，05 改 `Data.tsx` → 互不重叠。
- `runtime/server.mjs` 例外：任何规格只允许加 `import` 与路由分派行；01 先落地 `runtime/routes/` 目录与前缀分派骨架，后续规格只加一行。冲突时后提交者 rebase。
- 每个规格一个 agent；一个 agent 同时只做一份规格。

## 事实勘误

规格里的行号以 2026-09-17 凌晨代码为准核对过一次（`internal/spec-factcheck.md`），已把实质性错误（表名、文件名、工具签名、HTTP 路径）改回规格正文；纯行号漂移按「以代码为准适配」处理。标注「需新建」的路由/组件/迁移都是预期新建，不是引用错误。

## 完成定义（每份规格）

1. 「提交拆分」里的提交全部在 `main`，信息格式正确。
2. 「验收清单」人工项全部有截图 + 「做了什么 → 看到什么」；自动化项 `node --test` 全绿。
3. `npx tsc -b --pretty false`、`node runtime/smoke.mjs` 通过。
4. 报告按协议 §8 模板；「未做到 / 偏离规格」如实列出。
5. 协调器（Fable）派独立 agent 审查后判「合并保留 / 需小修 / 回滚重做」。

## 规格外的事

- 规格没写的行为 = 不做。想做 → 先在报告「需要 Ace 决定」里提。
- 发现规格与代码事实冲突（行号漂移、函数签名不同）→ 以代码为准适配，**不改语义**，在报告里注明。
- 发现规格自身矛盾 → 停下来问。

## 尚未写规格（后续）

- L2 代码级应用（Cordis 动态插件）— Ace 决定暂不做。
- 主动建议（proactive suggestions）— 依赖 01 + 07 落地后再写。
- 统一撤销（compensations 执行）— 依赖 05 落地后再写。
- MCP 原地重连（DSH 动态配置 API）— 越界项待拍板。
