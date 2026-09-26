---
cursor:
  subagentId: "bc-44993c0b-5a09-578e-bb21-6e996cad8b94"
---

# Verify: X 现网取消再下一跳 + 过审变更字段

**hardcoded:** none  
**pass:** yes  
**origin:** not pushed  
**step 9 / eval set / corpus / packaging / 决策 20/21:** not done  
**silent biz_write:** no  
**confirmed:** no（未点确认过账）  
**429:** no

## SHA

| 项 | 值 |
|---|---|
| daily main | `1a28a96d8fbf2bd4da463535924dfabb6414ad08` |
| HEAD | `1a28a96` on **main** |
| commit | `fix(biz): show 过审 preview field diffs` |

cwd `/Users/zxz/Documents/ai-project/fdex测试`  
会话 `session-8fd1178c-b21b-4d61-9c2b-c9c8a6337842`  
原句 `待审回款 ∩ 已到期合同`（词表+图：销售回款 ← 销售合同；`can`=现查/改行/删除/新建/过审）

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未做第 9 步。未出评测集。人确认之前不写库。

## 取消后下一跳

| 项 | 值 |
|---|---|
| 先跳 | 改行 · `pv_818c3c72293633aa` · 抽屉改行 · 1 行 PAY-2026-005 · hop |
| 取消 | 只关该 `preview_id`；抽屉关上；pending 不再握这次令牌 |
| 下一跳抽屉动作 | **过审** |
| 下一跳令牌 | `pv_76666241e6bb6fda`（新的，不是取消那张） |
| 过审预览变更字段 | **有**：回款状态 `待确认 → 已过`（schema 标题；field=`status` 来自词表/连接器列，不是写死「状态」） |
| 空提示 | 无「没有可展示的变更内容」 |
| 静默写 | 无 |

取消后表曾回到本 kind 销售回款列表（chip 销售回款20、首行 PAY202508027115、10 行），**不是**别的会话客户表。下一跳过审又回到同一条 hop 交集 1 行 PAY-2026-005。闸测 `cancel drops only that preview_id` 仍过。

## 对照

- 已对：取消只关这一次 `preview_id`；下一跳 pending / 抽屉 / footer 是过审。`gate.js` dismissWrite + `RecordsPanel` dismiss。现网点了取消。`main` `1a28a96`。
- 已对：过审预览只展示改过的字段（原值→新值）。`packSheet.changes` + `buildPreviewSummary` 走 `previewChangesFromSheetPayload`。图 `media/records-write-cancel.png` 抽屉「操作：过审」· 回款状态 待确认→已过。
- 已对：未静默 `biz_write`，未点确认过账。硬编码 none。
- 未对：第 9 步、评测集、审查 corpus、打包、决策 20/21。

截图: `media/records-write-cancel.png`  
探针: store `internal/verify-records-write-cancel.mjs`（不入产品仓）
