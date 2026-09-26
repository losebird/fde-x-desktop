---
cursor:
  subagentId: "bc-49c7c18d-c8dd-5232-ba33-89058548e2e1"
---

# Verify: BP 未持闭集 rewrite × 原 10 条（preview only）

**pass:** no（整块没收口；脚本 `cases:4`）
**main SHA:** `21d0141bb8cffd24ffc50a8bdcc31ae25fcd9fb0`
**branch:** `main`
**session:** `session-362775bb-3e52-445b-800e-960f566f0729`
**failCode:** cases:4
**静默 biz_write:** no
**确认过账:** no
**5174 未杀:** yes

## 十条

| # | 过/没过 | fail | 证据 |
|---|---|---|---|
| 1 | 过 | — | 工单 现查 21，hopWhere + steps 客户→工单，首行 TK20260623126。图 media/records-close-bp-case-01.png |
| 2 | 过 | — | 工单 8。图 media/records-close-bp-case-02.png |
| 3 | 过 | — | 销售回款 1 PAY-2026-005。图 media/records-close-bp-case-03.png |
| 4 | 脚本没过 / 产品表过 | ask-card-still-open(thinking=true) | 客户 改行 CUST2058，pv_78cade71c13979b7，停用合作→成交。左栏问卡仍开。图 media/records-close-bp-case-04.png |
| 5 | 过 | — | 费用报销 过审 97，pv_3164b4f2aeeaebc2，待审→过审。图 media/records-close-bp-case-05.png |
| 6 | 过 | — | LV-2026-018 NOT_FOUND → QJ20251027588 过审，pv_36aa10930babbb02，待审→已过。图 media/records-close-bp-case-06.png |
| 7 | 过 | — | TK20250211633 改行，pv_64b5dea23af12e64。图 media/records-close-bp-case-07.png |
| 8 | 过 | — | 采购订单 现查 1。图 media/records-close-bp-case-08.png |
| 9 | 过 | — | 产假切片空 → QJ20251027588 过审，pv_c06be01092416273。图 media/records-close-bp-case-09.png |
| 10 | 过 | — | 销售回款 改行，pv_3a31b579881714c2。图 media/records-close-bp-case-10.png |

已对：1、2、3、5、6、7、8、9、10；第 4 条产品表
未对：脚本第 4 条问卡
仍差：整块没收口。不报一次收住

闭集阀：graphOnly=过（HTTP 400 没有连接业务表） case1工单=过（工单 21） alreadyAtTarget=过（待审差 5/6/9；已过切片空） emptyCover=过 reopen=图过 / 脚本没过（右表空 共 0 条，图 media/records-close-bp-reopen.png；脚本读了旧 session pending）

## 图

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bp.png`
