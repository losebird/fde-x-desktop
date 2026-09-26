---
cursor:
  subagentId: "bc-ab6a9aa4-26f4-5572-9a4b-75a2d4692407"
---

# Verify: L+M+N records align

**hardcoded literals:** none
**pass:** yes
**failCode:** —

## SHA

| 项 | 值 |
|---|---|
| daily branch | `cursor/records-align-lmn-2407` |
| HEAD | `da77b81e2a5bf96885a3e4782808e75e39e622a4` |
| origin | not pushed |

产品仓已 commit L+M。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未 POST `/biz/preview`。未编造 AI 条数。

## N · 原句现网

- cwd `/Users/zxz/Documents/ai-project/fdex测试`
- 会话 `session-c4735df2-06ce-4c92-bff2-a74fbf863854`
- speech: 待审回款 ∩ 已到期合同
- rateLimited: no
- gateInjected: no

| 探针 | 值 |
|---|---|
| pending rows | 1 |
| pending first | PAY-2026-005 |
| pending hop | yes from=销售合同 |
| pending speech | 待审回款 ∩ 已到期合同 |
| 左 AI 口述条数 | 1 |
| chip | 销售回款1 |
| 横幅 rows | 1 |
| footer | 共 1 条 · 连接器 · 现查 00:20 |
| tbody | 1 first=1PAY-2026-005待审PAY-2026-0052026/06/20 21:31548002026-02-20银行转账首付款杭州数澜软件有限公司HT-2026-005SO-2026-005改行删除过审 |
| history value | q:{"kind":"销售回款","action":"现查","where":[{"keys":["stage","state","status"],"values":["open","pending","submitted","待审","新建"],"dateBefore":[],"dateAfter":[],"value":["pending","open","submitted","待审","新建"]}],"hopWhere":[{"keys":["stage","state","status"],"values":["expired","到期","已到期","过期"],"dateBefore":["dueDate","due_date","endDate","end_date","expireAt","expiredAt"],"dateAfter":[],"value":["expired","已到期","到期","过期"]}],"from":{"kind":"销售合同","where":[{"keys":["stage","state","status"],"values":["expired","到期","已到期","过期"],"dateBefore":["dueDate","due_date","endDate","end_date","expireAt","expiredAt"],"dateAfter":[],"value":["expired","已到期","到期","过期"]}]},"steps":["销售合同","销售回款"]} |
| history options | 17 |

历史 option（最多 8 条）:
- `（占位）` 本会话浮现历史
- `q:{"kind":"工单","action":"改行","where":[],"hopWhere":[],"from":null,"steps":[]}` 工单 · 改行 · 09/19 00:20
- `q:{"kind":"工单","action":"删除","where":[],"hopWhere":[],"from":null,"steps":[]}` 工单 · 删除 · 09/19 00:20
- `q:{"kind":"工单","action":"现查","where":[],"hopWhere":[],"from":null,"steps":[]}` 工单 · 现查 · 09/19 00:20
- `q:{"kind":"审批单","action":"现查","where":[],"hopWhere":[],"from":null,"steps":[]}` 审批单 · 现查 · 09/19 00:20
- `q:{"kind":"工单","action":"现查","where":[{"keys":["status"],"values":["processing"],"dateBefore":[],"dateAfter":[],"value":["processing"]}],"hopWhere":[],"from":null,"steps":[]}` 工单 · 现查 · processing
- `q:{"kind":"工单","action":"现查","where":[{"keys":["状态"],"values":["processing"],"dateBefore":[],"dateAfter":[],"value":["processing"]}],"hopWhere":[],"from":null,"steps":[]}` 工单 · 现查 · processing
- `q:{"kind":"客户","action":"现查","where":[{"keys":["status"],"values":["inactive","停用"],"dateBefore":[],"dateAfter":[],"value":["inactive","停用"]}],"hopWhere":[],"from":null,"steps":[]}` 客户 · 现查 · inactive、停用

截图: `media/records-hop-intersection.png` 已写

## M · 点历史换表

- picked: 工单 · 改行 · 09/19 00:20
- before first: 1PAY-2026-005待审PAY-2026-0052026/06/20 21:31548002026-02-20银行转账首付款杭州数澜软件有限公司HT-2026-005SO-2026-005改行删除过审
- after first: 1371713516372058处理中系统无法登录故障中2026/09/17 20:472026/03/10 03:49客户报障工单合肥卓越工业有限公司王敏冯丽371713516372058—改行删除
- before footer: 共 1 条 · 连接器 · 现查 00:20
- after footer: 共 1 条 · 连接器 · 改行 00:20
- after history value: q:{"kind":"工单","action":"改行","where":[],"hopWhere":[],"from":null,"steps":[]}
- cache first: 371713516372058
- cache rows: 1
- switched: yes
- pin held (value stayed): yes

截图: `media/records-history-switched.png` 已写

## 对照

- 已对：N 现网截图 `records-hop-intersection.png` 左 AI 口述「= 1 张」PAY-2026-005；右 tbody 1 / footer 1 / chip 销售回款1 / 横幅 1 行，首行 PAY-2026-005；pending hop from=销售合同。历史下拉选中「销售回款 · 现查 · 待审回款 ∩ 已到期合同」（`RecordsPanel` `historySurfaceId` + `briefQueryScopeLabel` 用 speech）。
- 已对：M 现网截图 `records-history-switched.png` 点本会话缓存「工单 · 改行」后 chip 工单1、表首行 371713516372058、footer「改行」、下拉仍钉在该项（`loadSurface` + `historyPinnedSurfaceIdRef`）。
- 未对：顶栏 / FaceSidebar / Stage / Palette / OfficialConversation hide（本切片没测）。
- 仍差：本会话历史 17 条含改行/删除写预览（规则允许，切到改行会再打开该条抽屉）；无 speech 的 option 仍可能只剩钟点或 where 值。

## 左 AI 摘录（现网，未编造）

```
· resolved 工单 · 现查 · closed、resolved、done 返回 来源：连接器 · 现查 00:20 序号 单号 状态 回款编号 更新时间 回款金额 回款日期 回款方式 备注 客户 合同 销售订单 操作 1 PAY-2026-005 待审 PAY-2026-005 2026/06/20 21:31 54800 2026-02-20 银行转账 首付款 杭州数澜软件有限公司 HT-2026-005 SO-2026-005 改行删除过审 共 1 条 · 连接器 · 现查 00:20 第 1 / 1 页 上一页 下一页 交给当前 AI FDE-X 功能 IM 业务应用 ⌘K
待审回款 ∩ 已到期合同 标准模式 对话 轨迹 系统提示词 待审回款 ∩ 已到期合同 9月18日 22:50 4 次工具调用 · 2 条消息 系统提示词 待审回款 ∩ 已到期合同 = 1 张（现查，生产 NocoBase） 回款单 状态 金额 回款日 方式 客户 合同 销售订单 备注 PAY-2026-005 待确认 54,800 2026-02-20 银行转账 杭州数澜软件有限公司 HT-2026-005 SO-2026-005 首付款 要从已到期合同 hop 到待审回款，目前就这一张。要打开 PAY-2026-005 或 HT-2026-005，说一声即可。 用量 124K tok 用时 43秒 9月18日 22:51 待审回款 ∩ 已到期合同 00:14 3 次工具调用 · 1 条消息 系统提示词 待审回款 ∩ 已到期合同 = 1 张（现查，生产 NocoBase） 回款单 状态 金额 回款日 方式 客户 合同 销售订单 备注 PAY-2026-005 待确认 54,800 2026-02-20 银行转账 杭州数澜软件有限公司 HT-2026-005 SO-2026-005 首付款 从已到期合同 hop 到待审回款，仍只有这一张。要打开 PAY-2026-005 或 HT-2026-005，说一声。 用量 152K tok 用时 47秒 00:15 系统提示词 待审回款 ∩ 已到期合同 00:20 2 次工具调用 系统提示词 待审回款 ∩ 已到期合同 = 1 张（现查） 回款单 状态 金额 回款日 方式 客户 合同 销售订单 备注 PAY-2026-005 待确认 54,800 2026-02-20 银行转账 杭州数澜软件有限公司 HT-2026-005 SO-2026-005 首付款 要打开 PAY-2026-005 或 HT-2026-005，说一声。 用量 189K tok 用时 31秒 00:20 发消息或创建任务, / 调用指令, @ 文件或对话 完全权限 grok-4.5 High 3 轮 10 步·106 tok/s 465K tok·缓存命中 31%
```

## P · 落到 main

**hardcoded literals:** none

| 项 | 值 |
|---|---|
| daily branch | `main` |
| main SHA | `da77b81e2a5bf96885a3e4782808e75e39e622a4` |
| from | `635787a` → ff-only `da77b81` |
| origin | not pushed |

拣进的 commit（`main..da77b81` 仅这三条，全是 L+M 产品）：

- `bb0cf27` fix(biz): one sheet identity for records chrome and sticky history
- `cfcf10a` fix(biz): bind current records surface by exact preview id
- `da77b81` fix(biz): list this-tab query snapshots in records history

| 文件 | 动作 |
|---|---|
| `runtime/tests/records-align.test.mjs` | A |
| `src/components/biz/RecordsPanel.tsx` | M |
| `src/lib/biz-list-query.ts` | M |
| `src/lib/biz-records-history.ts` | A |
| `src/lib/biz-sheet-display.ts` | M |
| `src/lib/biz-surface-cache.ts` | M |

未进产品仓：探针、`apps/desktop/package-lock.json`、`scripts/e2e-continue-handoff.mjs`（仍 untracked，未 git add）。未删文件。未杀 pnpm 5174。未重做 hop G/H / 第 9 步。未推 origin。

`runtime/tests/records-align.test.mjs`：6 pass / 0 fail。
