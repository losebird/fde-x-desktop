---
cursor:
  subagentId: "bc-15c022a7-c82a-5ae3-9590-137fd6e940e2"
---

# Verify · pending-sheet after Ace `pnpm dev` restart

**When**: 2026-09-17 19:23–19:25 (UTC+8)  
**Origin**: `http://127.0.0.1:5174` · workspace **fdex测试1**  
**BFF**: `http://127.0.0.1:4318`  
**Mode**: read-only · no code · no `biz_write` · no live AI 现查 · stack left running

## CURL

| # | Request | HTTP | Body / notes |
|---|---------|------|----------------|
| 1 | `GET :4318/health` | **200** | `state: healthy`; persistence healthy (44 tables); `ai-runtime` adapter **healthy** (0.1.5-rc.1); `im-business-adapter` **degraded** |
| 2 | `GET :5174/api/v1/ai/status` | **200** | `data.connected: true`, `state: connected`, `pid: 38604`, `bffOrigin: http://127.0.0.1:4318`, `startedAt: 2026-09-17T11:23:27.896Z` |
| 3a | `GET :4318/api/v1/biz/pending-sheet` | **200** | **非 404** · `sheet.kind`: 审批单 · `action`: 现查 · **20 rows** · 12 columns · `canWrite: false` |
| 3b | `GET :5174/api/v1/biz/pending-sheet` (proxy) | **200** | 与 3a 同形 JSON（`correlationId` 不同）· **非 404** · data **非空** |
| 4 | `GET :5174/api/v1/business/connections?workspaceId=1985293d-03bb-496f-ad69-5c7f2ac23149` | **200** | `items.length: 1` · `id: conn_lan_assist` · `provider: lan-assist` · `name: 局域网业务协作适配器` · `status: pending` · 行内 `workspaceId` 仍为 `ws_personal`（与 `ab19d26` 合并列表行为一致，见 [wave-fix-biz-connector-workspace.md](./wave-fix-biz-connector-workspace.md)） |

对比 [verify-records-surface-empty.md](./verify-records-surface-empty.md)（同日前、重启前）：当时 **pending-sheet 404**；本次重启后 **4318/5174 均为 200 + 20 行**。

## UI（已摸过）

1. `agent-browser` → `http://127.0.0.1:5174` · 顶栏 **业务应用** → Tab **业务记录**。
2. a11y：主区标题 `还没有 AI 查过或改过的业务记录`；绿条「事务底座运行正常」+ SQLite 44 表；黄条「事务底座未就绪…」并存。
3. DOM：`chipLike: 0`，`tables: 0`，`hasEmpty: true` — **无 40+ 型芯片**，**无审批单整表**。

Screenshot: [verify-pending-sheet-restart.png](../media/verify-pending-sheet-restart.png)

## 判据

| 判据 | 结果 | 证据 |
|------|------|------|
| pending-sheet 非 404（直打 + 代理） | **PASS** | CURL 3a/3b · 200 + 20 rows |
| AI status connected | **PASS** | CURL 2 |
| connections 含 lan-assist（post-`ab19d26` 列表） | **PASS** | CURL 4 · `conn_lan_assist` / `lan-assist` |
| 业务记录 Tab 仍空面（非 catalog browser） | **PASS** | 截图 + a11y/DOM |

## 对照表（本 run 最小集）

| 项 | 母体/期望 | fdex 实测 | 状态 |
|----|-----------|-----------|------|
| BFF pending-sheet | 路由存在、可读 sheet | 200 · 审批单 · 20 行 · 现查 | **已对** — CURL 3a/3b |
| Vite 代理 pending-sheet | 同 BFF | 200 · 同 payload 形 | **已对** — CURL 3b |
| AI 连通 | DSH connected | `connected: true` pid 38604 | **已对** — CURL 2 |
| lan-assist @ fdex测试1 UUID | `ab19d26` 合并种子行 | 1 item · provider lan-assist | **已对** — CURL 4（行上 workspaceId 仍 `ws_personal`） |
| 业务记录 UI vs pending API | Tab 只浮现 AI 触及记录，不整表 | API 有 20 行 · UI 空态 | **仍差（设计）** — API/UI 分工；非 404 回归 |
| 顶栏 chips / 全表 | 拒收 catalog browser | 0 chip · 0 table | **已对** — UI |

## Verdict

- **API**：重启后 **pending-sheet 从 404 → 200**，数据 **非空**（20 行审批单现查）；AI **connected**；**lan-assist** 连接器在 UUID 查询下 **可见**。
- **UI**：**业务记录** Tab 仍为 **AI 空态面**（符合 post-`4ba940a` 产品面；**未**因 pending-sheet 数据自动渲染整表或型芯片）。

未做：live AI 现查（避免写入）；未改代码；未杀进程。
