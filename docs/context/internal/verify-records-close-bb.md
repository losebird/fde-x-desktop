---
cursor:
  subagentId: "bc-85c1f888-3d9f-5f35-8404-b5e41069c6b1"
---

# Verify: BB 业务记录整块收口（10 条活用例）

**pass:** no
**main SHA:** `1139b2e190df395293a285efd067b0e3382778b9`
**branch:** `cursor/records-close-bb-c6b1`（未推 origin）
**failCode:** case-4:drawer-mismatch(none)
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
| 1 | 过 | want=现查 kind=工单 action=现查 rows=22 first=TK20260623126 banner="AI 刚查了 工单 · 22 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同" hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":true,"steps":["客户","工单"]} sameSheet=true chips=[{"kind":"工单","count":22,"text":"工单22"},{"kind":"客户","count":15,"text":"客户15"}] diffs=undefined left=true  fail=— |
| 2 | 过 | want=现查 kind=工单 action=现查 rows=1 first=TK20260105702 banner="AI 刚查了 工单 · 1 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？客户 · 现查 · 停用客户还有哪些没关的工单？工单 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同" hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":false,"steps":["客户","工单"]} sameSheet=true chips=[{"kind":"工单","count":1,"text":"工单1"},{"kind":"客户","count":1,"text":"客户1"}] diffs=undefined left=true  fail=— |
| 3 | 过 | want=现查 kind=销售回款 action=现查 rows=1 first=PAY-2026-005 banner="AI 刚查了 销售回款 · 1 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？客户 · 现查 · 停用客户还有哪些没关的工单？工单 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？客户 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？" hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":true,"steps":["销售合同","销售回款"]} sameSheet=true chips=[{"kind":"销售回款","count":1,"text":"销售回款1"},{"kind":"销售合同","count":1,"text":"销售合同1"}] diffs=undefined left=true  fail=— |
| 4 | 没过 | want=改行 kind=— action=— rows=— first=— banner="AI 刚查了 客户 · 37 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？客户 · 现查 · 停用客户还有哪些没关的工单？工单 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？客户 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？销售合同 · 现查 · 待审回款挂在哪些合同上？把已到期的那些摊出来。客户 · 改行 · 把停用客户恒通改成成交。只要预览，不要过账，不要 biz_write。销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同" hop=null sameSheet=undefined chips=["客户37"] diffs=undefined left=undefined  fail=drawer-mismatch(none) |
| 5 | 没过 | want=过审 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 6 | 没过 | want=过审 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 7 | 没过 | want=改行 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 8 | 没过 | want=现查 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 9 | 没过 | want=过审 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 10 | 没过 | want=改行 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |

口语原句只当活用例，未写入 `src/`。where/hop 对照词表+图；芯片对照当次命中。

## 取消 / 浮现历史 / 切会话

| 项 | 过/没过 | 证据 |
|---|---|---|
| 取消预览不再弹出 | 没过 | null |
| 浮现历史换表 | 没过 | null |
| 切会话不炸 | 没过 | GET session={"http":200,"code":"","message":"","id":"session-e2abfad3-9997-42b1-85b9-97f40057075a"} after=null ports=null |

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



已对：1、2、3（第 3 条右表 `PAY-2026-005` / 销售回款1 / 横幅「AI 刚查了 销售回款 · 1 行」，母体 pending hop 合同→回款；fdex `RecordsPanel` `shouldHoldSideKindView` + 现网图 `bb-case-03.png`）
未对：4 改行抽屉（闸在两家「恒通」上提问，pending 客户37、无 preview_id、抽屉没开）；5–10、取消预览、浮现历史、切会话（第 4 条失败即停）
仍差：case-4:drawer-mismatch(none)

`/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e` 本机没有，只写了 AgentStores `files/`。

产品：`cursor/records-close-bb-c6b1` `1139b2e`（其上 `5842041` 为 apply/paint）。`0e85357` 短名不当 leftover 仍在历史里。未推 origin。未 `git add -A`。未删文件。未杀 pnpm 5174（pid 39206）。

## 图

十格按序 1–10，不是只拍合同∩回款。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bb.png`
