---
cursor:
  subagentId: "bc-59d2d612-ea68-552f-a3e2-49292cb116f4"
---

# Verify: BC 业务记录整块收口（10 条活用例）

**pass:** no
**main SHA:** `d2f7eaae1d4b095435c0252b68a2bf54d29d4cdc`
**branch:** `main`（未推 origin）
**failCode:** case-5:action-mismatch(改行)
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
| 1 | 过 | want=现查 kind=工单 action=现查 rows=22 first=TK20260623126 banner="AI 刚查了 工单 · 22 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 改行 · 现查工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？" hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":true,"steps":["客户","工单"]} sameSheet=true chips=[{"kind":"工单","count":22,"text":"工单22"},{"kind":"客户","count":15,"text":"客户15"}] diffs=undefined left=true  fail=— |
| 2 | 过 | want=现查 kind=工单 action=现查 rows=1 first=TK20260105702 banner="AI 刚查了 工单 · 1 行 · 会话 session- · 刚刚本会话浮现历史工单 · 改行 · 现查工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？客户 · 现查 · 停用客户还有哪些没关的工单？工单 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。" hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":false,"steps":["客户","工单"]} sameSheet=true chips=[{"kind":"工单","count":1,"text":"工单1"},{"kind":"客户","count":1,"text":"客户1"}] diffs=undefined left=true  fail=— |
| 3 | 过 | want=现查 kind=销售回款 action=现查 rows=1 first=PAY-2026-005 banner="AI 刚查了 销售回款 · 1 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 改行 · 现查工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？客户 · 现查 · 停用客户还有哪些没关的工单？工单 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？客户 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？" hop={"hop":true,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":true,"steps":["销售合同","销售回款"]} sameSheet=true chips=[{"kind":"销售回款","count":1,"text":"销售回款1"},{"kind":"销售合同","count":1,"text":"销售合同1"}] diffs=undefined left=true  fail=— |
| 4 | 过 | want=改行 kind=客户 action=改行 rows=1 first=CUST2056 banner="AI 刚查了 客户 · 1 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 新建 · 待审回款 ∩ 已到期合同销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 改行 · 现查工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？客户 · 现查 · 停用客户还有哪些没关的工单？工单 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？客户 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？销售合同 · 现查 · 待审回款挂在哪些合同上？把已到期的那些摊出来。客户 · 改行 · 把停用客户恒通改成成交。只要预览，不要过账，不要 biz_write。销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同客户 · 改行 · 把停用客户恒通改成成交。只要预览，不要过账，不要 biz_write。" hop={"hop":false,"fromKind":"","fromRows":0,"fromFirst":"","hopWhere":false,"steps":[]} sameSheet=true chips=[{"kind":"客户","count":1,"text":"客户1"}] diffs=true left=true  fail=— |
| 5 | 没过 | want=过审 kind=— action=— rows=— first=— banner="AI 刚查了 费用报销 · 0 行 · 会话 session- · 刚刚本会话浮现历史销售回款 · 现查 · 销售回款销售回款 · 现查 · 待审回款 ∩ 已到期合同销售回款 · 改行 · 待审回款 ∩ 已到期合同销售回款 · 删除 · 待审回款 ∩ 已到期合同销售回款 · 过审 · 待审回款 ∩ 已到期合同销售回款 · 新建 · 待审回款 ∩ 已到期合同销售回款 · 现查 · 过审待审回款 ∩ 已到期合同那一行，只要预览，不要过账，不要 biz_write。工单 · 改行 · 现查工单 · 现查 · 现查工单 · 现查 · 停用客户还有哪些没关的工单？客户 · 现查 · 停用客户还有哪些没关的工单？工单 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？客户 · 现查 · 故障类而且紧急、还没关的工单是哪家客户的？销售合同 · 现查 · 待审回款挂在哪些合同上？把已到期的那些摊出来。客户 · 改行 · 把停用客户恒通改成成交。只要预览，不要过账，不要 biz_write。费用报销 · 过审 · 待审报销单都过一下。只要预览，不要过账，不要 biz_write。费用报销 · 现查 · 待审的费用报销报销单 · 过审 · 待审报销单 EXP20251224598 过审预览费用报销 · 改行 · 待审报销单都过一下。只要预览，不要过账，不要 biz_write。客户 · 改行 · 把停用客户恒通改成成交。只要预览，不要过账，不要 biz_write。" hop=null sameSheet=undefined chips=["费用报销"] diffs=undefined left=undefined  fail=action-mismatch(改行) |
| 6 | 没过 | want=过审 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 7 | 没过 | want=改行 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 8 | 没过 | want=现查 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 9 | 没过 | want=过审 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |
| 10 | 没过 | want=改行 kind=— action=— rows=— first=— banner="" hop=null sameSheet=undefined chips=[] diffs=undefined left=undefined  fail=not-run |

口语原句只当活用例，未写入 `src/`。where/hop 对照词表+图；芯片对照当次命中。

## 取消 / 浮现历史 / 切会话

| 项 | 过/没过 | 证据 |
|---|---|---|
| 取消预览不再弹出 | 过 | {"clicked":true,"drawerOpen":false,"drawerAction":"","first":"CUST2056","tbodyRows":1} |
| 浮现历史换表 | 没过 | null |
| 切会话不炸 | 没过 | GET session={"http":200,"code":"","message":"","id":"session-e81b06ed-56c6-4188-98bb-333bc9763c57"} after=null ports=null |

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



已对：1、2、3、4；取消预览（第 4 条后抽屉关上，表仍 CUST2056 1 行）
未对：6、7、8、9、10、浮现历史、切会话
仍差：case-5 want=过审，pending 落到 费用报销 · 改行 · 0 行。左栏当时已出过审预览 97 条 + `pv_f96535e005d7f708` 未用；横幅随后出现「费用报销 · 改行」。6–10 按失败即停未跑。

第 3 条现网：销售回款 1 行 `PAY-2026-005`，chip 销售回款1 / 销售合同1。
第 4 条现网：改行预览 客户 1 行 `CUST2056`，状态 暂停合作 → 成交客户，不是客户目录 37。`src/` 无恒通/武汉云启。
BB 右表换 pending 已在 main：`66dc35b` / `66aa73c`。`0e85357` leftover 仍在历史上。未推 origin。5174 pid 39206。

`/cursor/stores/...` 只读，本刀只写了 AgentStores `files/`。

## 图

十格按序 1–10，不是只拍合同∩回款。

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bc.png`
