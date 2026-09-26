---
cursor:
  subagentId: "bc-6e02db5e-a056-5087-b1cc-bac85cb3338b"
---

# Verify: BA 业务记录整块收口（10 条活用例）

**pass:** no
**main SHA:** `0e853573e251324439b86d7a002dc86a83dd10e6`
**branch:** `main`（未推 origin）
**failCode:** case-3:sheet-mismatch(footer=1,tbody=1,pending=1,ui=TK20260105702,pendingFirst=PAY-2026-005)
**闸注入:** no
**静默 biz_write:** no
**确认过账:** no
**自动发 IM:** no
**5174 未杀:** yes
**src 写入例字面量:** none
**走访不动:** yes

## 1–10

| # | 过/没过 | 现网 |
|---|---|---|
| 1 | 过 | want=现查 kind=工单 action=现查 rows=22 first=TK20260623126 hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":true,"steps":["客户","工单"]} sameSheet=true chips=[{"kind":"工单","count":22,"text":"工单22"},{"kind":"客户","count":15,"text":"客户15"}] diffs=undefined left=true  fail=— |
| 2 | 过 | want=现查 kind=工单 action=现查 rows=1 first=TK20260105702 hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":false,"steps":["客户","工单"]} sameSheet=true chips=[{"kind":"工单","count":1,"text":"工单1"},{"kind":"客户","count":1,"text":"客户1"}] diffs=undefined left=true  fail=— |
| 3 | 没过 | want=现查 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=["工单1","客户1"] diffs=undefined left=undefined  fail=sheet-mismatch(footer=1,tbody=1,pending=1,ui=TK20260105702,pendingFirst=PAY-2026-005) |
| 4 | 没过 | want=改行 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 5 | 没过 | want=过审 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 6 | 没过 | want=过审 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 7 | 没过 | want=改行 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 8 | 没过 | want=现查 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 9 | 没过 | want=过审 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 10 | 没过 | want=改行 kind=— action=— rows=— first=— hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |

口语原句只当活用例，未写入 `src/`。where/hop 对照词表+图；芯片对照当次命中。

## 取消 / 浮现历史 / 切会话

| 项 | 过/没过 | 证据 |
|---|---|---|
| 取消预览不再弹出 | 没过 | null |
| 浮现历史换表 | 没过 | null |
| 切会话不炸 | 没过 | GET session={"http":200,"code":"","message":"","id":"session-a823c0af-3b34-4856-bfed-03459d350e26"} after=null ports=null |

## 决策 22

| 项 | 过/没过 | 证据 |
|---|---|---|
| 三 Tab | 过 | {"app":true,"records":true,"ops":true} |
| 创建应用入口 | 过 | entry=true wizard=true |
| 拉伸 48/224 | 过 | wide=224 narrow=48 |
| 问 AI | 过 | button=true left={"asideW":224,"asideOpen":true,"sessionTitle":true} |
| 走访应用还在 | 过 | catalog=true opened=true before=2026-09-19T06:03:58.932Z after=2026-09-19T06:03:58.932Z |

## 禁区

硬编码进 src=none 闸注入=false 评测集/第9步/决策20/21/corpus去留=未做



已对：1、2
未对：3（现网差）；4–10（没跑）
仍差：case-3:sheet-mismatch(footer=1,tbody=1,pending=1,ui=TK20260105702,pendingFirst=PAY-2026-005)

## 图

十格按序 1–10，不是只拍合同∩回款。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-ba.png`
