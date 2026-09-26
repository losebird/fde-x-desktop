---
cursor:
  subagentId: "hold-sheet-after-cancel"
---

# Verify: BK 契约 3 取消不倒目录

**product SHA:** `8096470`
**branch:** `main`
**闸注入:** no
**静默 biz_write:** no

## 因果

同指纹批量改行原先不收 displayBeforeWriteRef；GET pending-sheet 用目录 lastEmittedPending 盖 hall。取消必须回到取消前那张 hop 现查，不能倒连接器目录。

## 对照

| 项 | 状态 | 证据 |
|---|---|---|
| 取消前 hop 表 | 已摸过 | kind=工单 rows=21 chips=工单21,客户14 first=TK20260623126 |
| 改行抽屉 | 已摸过 | action=改行 drawer=true preview=pv_07d1cb8ce0f9988c |
| 契约 3 取消仍是这张 | 已对 | catalogDump=false heldBatch=true chips=工单21,客户14 footer=21 first=TK20260623126 drawer=false |
| 契约 1–2 | 未对（本刀不重开） | |
| 决策 22 三 Tab | 已摸过 | {"apps":true,"records":true,"ops":true} |

已对：取消后右表/chip/footer 仍是取消前 hop 表
未对：契约 1–2（不重开）
仍差：整块 10 条没跑

## 图

/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-contract-cancel.png
