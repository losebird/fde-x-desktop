---
cursor:
  subagentId: "records-close-contract"
---

# Verify: 收口总因 leftover 四条

**product SHA:** `5721789`（其上 `bb12a33`）
**branch:** `main`
**闸注入:** no
**静默 biz_write:** no
**src 活用例字面量:** none

## 因果

人话进 DSH，闸只校验 structured kind（词表+图+连接器表）。空资源拒预览；口语短名走 型槽/aliases 收到已连接表；集合标题「工单」仍是自己。BFF 合并目录不再挤掉工单/客户。空表盖不掉这一张；取消写预览回到 listBeforeWrite，GET/watch 不得因 dismissed token 把 pending 置空。

## 对照

| 契约 | 状态 | 证据 |
|---|---|---|
| 1 只有已连接表能预览；口语别名；空资源拒 | 已对 | empty={"code":"validation_error","message":"该对象没有连接业务表"} aliasKind=费用报销 hopKind=工单 rows=21 |
| 2 一句话一张 pending | 已对 | {"sameKind":true,"sameRows":true,"sameFirst":true,"kind":"工单","rows":21} |
| 3 右表换上这一张；取消不倒目录 | 已对 | hopFooter=21 decoyHold 工单21；cancel clicked 后 kind=工单 action=现查 rows=21 speech=停用客户… chips=工单21,客户14 drawer关 |
| 4 模糊多家先选再继续 | 已对（不重开） | 五问 §12 |
| hop 工单不是审批单 | 已对 | kind=工单 chips=工单21,客户14 first=TK20260623126 |

已对：连接表/别名/空资源；一张 pending；右表+取消；工单 hop
未对：拉伸 48/224
仍差：整块 10 条没跑

## 图

/Users/zxz/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/records-close-contract.png
