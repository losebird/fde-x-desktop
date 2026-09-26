---
cursor:
  subagentId: "bc-41293846-e0c1-578b-ad3b-fac83a7baa04"
---

# Verify: BS pending-tube catalog dump (preview only)

**pass:** no  
**main SHA:** `7058eec8f686b52a5e598db0255310b13fc72486`  
**branch:** `main`  
**failCode:** `cases:5,6,7,8,9,10,11,12,13`  
**静默 biz_write:** no  
**确认过账:** no  
**5174 未杀:** yes (pid 1985)  
**origin push:** no  

Product fix on this SHA: catalog dump must not cover the utterance sheet (`sheetAfterCancelCover` bidirectional skip + gate `shouldKeepPopulatedListSheet`). Preview only. Not 图过. Not 整块收口.

## 十条 + 复杂句

| # | 过/没过 | failCode | kind / rows | 图 |
|---|---|---|---|---|
| 1 | 过 | — | 工单 ×21 C1–C4 | `media/records-close-bs-case-01.png` |
| 2 | 过 | — | 工单 ×8 C1–C4 | `media/records-close-bs-case-02.png` |
| 3 | 过 | — | 销售回款 ×1 C1–C4 | `media/records-close-bs-case-03.png` |
| 4 | 过 | — | 客户 ×1 改行 CUST2058 pickThenWrite=singleMatch C1–C4 | `media/records-close-bs-case-04.png` |
| 5 | 没过 | left-ai-missing-row | harness 未填 kind；截图右表是 费用报销 97 行 过审抽屉 | `media/records-close-bs-case-05.png` |
| 6 | 没过 | left-ai-missing-row | swappedTo QJ20251027588；截图右表是 请假申请 1 行 过审 | `media/records-close-bs-case-06.png` |
| 7 | 没过 | left-ai-missing-row | swappedTo TK20250211633 | `media/records-close-bs-case-07.png` |
| 8 | 没过 | left-ai-missing-row | — | `media/records-close-bs-case-08.png` |
| 9 | 没过 | action-mismatch(现查) | swappedTo QJ20251101520 | `media/records-close-bs-case-09.png` |
| 10 | 没过 | pending-unchanged | — | `media/records-close-bs-case-10.png` |
| 11 | 没过 | left-ai-missing-row | 复杂 现查 | `media/records-close-bs-case-11.png` |
| 12 | 没过 | action-mismatch(过审) | 复杂 现查 | `media/records-close-bs-case-12.png` |
| 13 | 没过 | left-ai-missing-row | 复杂 现查 | `media/records-close-bs-case-13.png` |

已对：1、2、3、4（同 SHA 现网；1–4 二次跑复用该次结果）  
未对：5、6、7、8、9、10、11、12、13  
仍差：DSH 会话 iframe 在二次跑里没有进 harness `iframeBlob`（截图也没有「对话/轨迹」中栏），所以 write 条被打成 `left-ai-missing-row`；9/10/12 是 leftover action/pending。截图里 5/6 右表看起来落在对应 sheet，这不是 C1–C4 过。

## leftovers（闭集）

| 项 | 过/没过 | 证据 |
|---|---|---|
| catalog 工单 vs 工单处理记录 | 过 | 短=工单/`biz_tickets`；长=工单处理记录/`biz_ticket_logs`，不 endsWith 折叠 |
| fake kind | 过 | POST preview `GraphOnlyOrphanKind` → 400 `validation_error`「该对象没有连接业务表」 |
| leftover 现查 covering write | 没过 | 用 case4 CUST2058 改行 seed：preview HTTP 200 sheet=客户/改行/1 行，随后 GET pending-sheet 空（beforeCover kind=null） |
| empty cover | 没过 | pending 空，skipped `no-pending-kind` |
| reopen | 过 | 新 session hall 无他会话 sheet |
| case4 ask/pick vs land | 过（singleMatch） | 恒通唯一命中，抽屉 改行 CUST2058，未走多行 pick 列表 |
| already-at-target empty drawer | 未触发 | 无该 failCode |

`leftoversPass`: false

## 图（均已存在）

十格拼图：

`/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs.png`

逐条：

- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-01.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-02.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-03.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-04.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-05.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-06.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-07.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-08.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-09.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-10.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-11.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-12.png`
- `/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-bs-case-13.png`

机器记录：`internal/verify-records-close-bs.json`  
跑日志：`internal/verify-records-close-bs.run.log`
