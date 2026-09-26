# Verify: Q records history switch

**hardcoded:** none
**pass:** yes
**failCode:** —

## SHA

| 项 | 值 |
|---|---|
| daily branch | `main` |
| HEAD | `5afaa40b149f8ba812e48443327252f5808ed822` |
| origin | not pushed |

cwd `/Users/zxz/Documents/ai-project/fdex测试`

## Start (1-row sheet)

- tbody 1 firstNo `PAY-2026-005`
- footer 共 1 条 · 连接器 · 现查 01:01
- banner AI 刚查了 销售回款 · 1 行 · 会话 session- · 刚刚本会话浮现历史工单 · 改行工单 · 删除审批单 · 现查工单 · 现查 · processing工单 · 现查 · processing客户 · 现查 · inactive、停用销售回款 · 现查 · 待审回款 ∩ 已到期合同工单处理记录 · 现查
- chips 销售回款1
- history options 8
  - `` 本会话浮现历史
  - `q:{"kind":"工单","action":"改行","where":[],"hopWhere":[],"from":null,"steps":[]}` 工单 · 改行
  - `q:{"kind":"工单","action":"删除","where":[],"hopWhere":[],"from":null,"steps":[]}` 工单 · 删除
  - `q:{"kind":"审批单","action":"现查","where":[],"hopWhere":[],"from":null,"steps":[]}` 审批单 · 现查
  - `q:{"kind":"工单","action":"现查","where":[{"keys":["status"],"values":["processing"]` 工单 · 现查 · processing
  - `q:{"kind":"工单","action":"现查","where":[{"keys":["状态"],"values":["processing"],"da` 工单 · 现查 · processing
  - `q:{"kind":"客户","action":"现查","where":[{"keys":["status"],"values":["inactive","停` 客户 · 现查 · inactive、停用
  - `q:{"kind":"销售回款","action":"现查","where":[{"keys":["stage","state","status"],"valu` 销售回款 · 现查 · 待审回款 ∩ 已到期合同
  - `q:{"kind":"工单处理记录","action":"现查","where":[],"hopWhere":[],"from":null,"steps":[]` 工单处理记录 · 现查

## 现查 history

- picked: 审批单 · 现查
- cache found: yes kind=审批单 action=现查 rows=20 first=QJ20240425718
- after footer 20 firstNo `QJ20240425718` pin=yes
- drawerOpen no emptyChange no

## 改行 history

- picked: 工单 · 改行
- cache found: yes kind=工单 action=改行 rows=1 first=371713516372058
- after tbody 1 firstNo `371713516372058` pin=yes
- drawerOpen no emptyChange no

## 对照

- 已对：现网 fdex测试 从 1 行回款 `PAY-2026-005` 切到「审批单 · 现查」（缓存 20 行 `QJ20240425718`，footer 共 20 条），再切「工单 · 改行」（缓存 1 行 `371713516372058`），下拉钉住，空写预览抽屉未出现。`RecordsPanel.loadSurface` + `sheetHasConfirmablePreviewChanges`。option 非钟点（speech 或 where/hop）。只列本会话 8 条。`main` `5afaa40`。
- 未对：顶栏 / FaceSidebar / Stage / Palette / OfficialConversation hide（本切片没测）。
- 仍差：无 speech/where/hop 的写操作 option 第三段为空（未用钟点填）。

截图: `media/records-history-switched.png`
