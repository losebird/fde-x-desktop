---
cursor:
  subagentId: "bc-41293846-e0c1-578b-ad3b-fac83a7baa04"
---

# Verify: BT named pending GET (preview only)

**pass:** no  
**main SHA:** `097834833b9e72e70ff3940f1e08910c2ab3f9bf`  
**branch:** `main`  
**failCode:** `cases:5,7,8,10,11,13`  
**静默 biz_write:** no  
**确认过账:** no  
**5174 未杀:** yes (pid 1985)  
**origin push:** no  

Product: named GET pending-sheet no longer drops an unstamped hall after 改行 preview 200. Preview only. Not 图过. Not 整块收口.

## 十条 + 复杂句

| # | 过/没过 | failCode | kind / rows | 图 |
|---|---|---|---|---|
| 1 | 过 | — | 工单 ×21 现查 C1–C4 | `media/records-close-bt-case-01.png` |
| 2 | 过 | — | 工单 ×8 现查 C1–C4 | `media/records-close-bt-case-02.png` |
| 3 | 过 | — | 销售回款 ×1 现查 C1–C4 | `media/records-close-bt-case-03.png` |
| 4 | 过 | — | 客户 ×1 改行 C1–C4 | `media/records-close-bt-case-04.png` |
| 5 | 没过 | pending-unchanged | 仍是客户 ×1 改行 | `media/records-close-bt-case-05.png` |
| 6 | 过 | — | 费用报销 ×97 过审 C1–C4 | `media/records-close-bt-case-06.png` |
| 7 | 没过 | pending-unchanged | 工单 ×14 现查（swap TK20250211633） | `media/records-close-bt-case-07.png` |
| 8 | 没过 | pending-unchanged | 工单 ×14 现查 | `media/records-close-bt-case-08.png` |
| 9 | 过 | — | 请假申请 ×1 过审 swap QJ20251027588 C1–C4 | `media/records-close-bt-case-09.png` |
| 10 | 没过 | action-mismatch(改行) | 工单 ×1 改行（swap PAY-2026-005） | `media/records-close-bt-case-10.png` |
| 11 | 没过 | hop-not-工单 | 供应商 ×20 现查 | `media/records-close-bt-case-11.png` |
| 12 | 过（harness） | — | 供应商 ×1 现查 C1–C4；话是到期合同待审回款 | `media/records-close-bt-case-12.png` |
| 13 | 没过 | hop-not-工单 | 请假申请 ×48 现查 | `media/records-close-bt-case-13.png` |

已对：1、2、3、4、6、9（+12 harness）  
未对：5、7、8、10、11、13  
仍差：5/7/8 DSH 未换 pending；10 改行错落工单；11/13 hop 不是工单。1–4 仍过。

## leftovers（闭集）

| 项 | 过/没过 | 证据 |
|---|---|---|
| catalog 工单 vs 工单处理记录 | 过 | 短=工单/`biz_tickets`；长=工单处理记录/`biz_ticket_logs` |
| fake kind | 过 | 400 `validation_error`「该对象没有连接业务表」 |
| leftover 现查 covering write | 过 | seed 客户/改行/CUST2058 preview 200；GET 仍 改行 1 行，现查未盖住 |
| empty cover | 过 | 空 过审 后 GET 仍 客户 改行 CUST2058 |
| reopen | 过 | 新 session hall 空 |
| case4 ask/pick vs land | 过 | 恒通 1 行 改行 |
| already-at-target empty drawer | 未触发 | — |

`leftoversPass`: true

## 图（均已存在）

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt.png`

- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-01.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-02.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-03.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-04.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-05.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-06.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-07.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-08.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-09.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-10.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-11.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-12.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bt-case-13.png`

机器记录：`internal/verify-records-close-bt.json`  
跑日志：`internal/verify-records-close-bt.run.log`
