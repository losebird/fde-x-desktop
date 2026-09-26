---
cursor:
  subagentId: "bc-f9f4acbe-8dd0-57b7-843d-aea8170b9ae8"
---

# Verify: BQ 闭集 × 原 10 条（preview only；不自判收口）

**pass (script):** yes  
**main SHA:** `a31ca544cbf7adb92b35c4466645fc15e987fe9a`  
**branch:** `main`  
**session:** `session-d51bdf87-37b1-40f9-a34d-da0b7a86d68a`  
**静默 biz_write:** no  
**确认过账:** no  
**origin push:** no  
**5174 未杀:** yes (pid 39206)  
**硬编码进 src/runtime:** 无（kind / action / field / year / table / relation 均未写死）

不报图过。不报整块收口。对抗审查归协调器。

## 已对 / 未对 / 仍差

- **已对（本枪脚本+对照）：** 原 10 条；graphOnly HTTP 400「该对象没有连接业务表」；第 1 条工单 21 不是客户 0；第 4 条左栏问卡未开、无「深度求索中」转圈；重开会话 GET 未端出上一会话销售回款（新 sid `session-05848222-532a-4fd7-b9b4-37456a6249fa`，右表「当前暂还没有可预览的行」共 0 条）；空表盖：1–10 无空覆盖。
- **未对：** 无（脚本）。已过目标态空抽屉本枪未打到（`LV-2026-018` 库里没有；第 6/9 互换到待审行，抽屉有 `待审 → 已过`）。
- **仍差：** 协调器审图。第 4 条脚本 hit-set 点了页内最后一行 `CUST2169`，落表/抽屉是 `CUST2058`（恒通，暂停合作→成交客户，`pv_d02ab87e6908230f`）——以图为准。

## 十条

| # | 过/没过 | kind / 动作 / 首行 | 令牌 / 漂移 |
|---|---|---|---|
| 1 | 过 | 工单 现查 21 `TK20260623126` hop 客户→工单 | — |
| 2 | 过 | 工单 现查 8 `TK20250211633` | — |
| 3 | 过 | 销售回款 现查 1 `PAY-2026-005` | — |
| 4 | 过 | 客户 改行 1 `CUST2058` | `pv_d02ab87e6908230f`；问卡关 |
| 5 | 过 | 费用报销 过审 97 `EXP20251224598` | `pv_87921f4d94b4596d` |
| 6 | 过 | 请假申请 过审 1 `QJ20251027588` | `pv_d36839668a92e3e9`；`LV-2026-018`→`QJ20251027588` |
| 7 | 过 | 工单 改行 1 `TK20250211633` | `pv_84197d0475caf914`；武汉云启已 resolved→紧急未关 |
| 8 | 过 | 采购订单 现查 1 `PO20250407926` | — |
| 9 | 过 | 请假申请 过审 1 `QJ20251027588` | `pv_7bd021c851a02000`；产假切片空→同条件待审 |
| 10 | 过 | 销售回款 改行 1 `PAY-2026-005` | `pv_05b975cfafcca360`；东莞联创 lookup 空，现网到期合同待审回款 |

替换号只出现在本报告 / json，未写入 `src/` `runtime/`。

## 闭集阀

- graphOnly：过（HTTP 400，catalog 无 GraphOnlyConcept）
- case1工单：过（工单 21）
- alreadyAtTarget：脚本过（待审差 5/6/9；产假切片空记在 9）。未打到「无需再过审」文案。
- emptyCover：过
- reopen：过（`foreignGet=false` `paintedOld=false` `emptyNew=true`；上一会话 kind=销售回款）

## 图

- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bq-case-01.png` … `10.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bq-reopen.png`
- stitch `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bq.png`

## 产品改动（已在 local main）

`a31ca54`：写预览 apply 时 `cancelAi` 清 leftover AskUserQuestion；GET/SSE/apply 按 session 戳过滤；未盖章 GET 不记忆。无 kind/action/table 字面量。

## 未写死

连接 kind 来自 `/api/v1/biz/kinds`；口语→表走闸 leftover / `resolveConnectedKind`；漂移互换用 lookup 同 kind+动作+条件现网行；假 kind 用 catalog 里无 resource 的概念（本枪 catalog 已无，直接 400）。
