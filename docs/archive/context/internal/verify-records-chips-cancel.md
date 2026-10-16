---
cursor:
  subagentId: "bc-cd5fff7c-5194-5d8f-a3fa-810fe2903127"
---

# Verify: Z 连接器芯片分开 + 取消后不闪目录

**pass:** yes  
**hardcoded:** none  
**origin:** not pushed  
**silent biz_write:** no  
**confirmed:** no（未点确认过账）  
**429:** no  
**step 9 / eval set / corpus / packaging / overlay / 决策 20/21:** not done

## SHA

| 项 | 值 |
|---|---|
| daily main | `1358425669b5311760961b727125a6e19730c642` |
| HEAD | `1358425` on **main** |
| commit | `fix(biz): split connector picker from kind chips and keep floated sheet on cancel` |

cwd `/Users/zxz/Documents/ai-project/fdex测试`  
会话 `session-99d282ee-c1f2-4b1c-ae1e-c2ae748f96d0`  
原句 `待审回款 ∩ 已到期合同`（词表+图：销售回款 ← 销售合同）  
写预览 `改行` · `pv_db5988bfb1d20012` · 未过账

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未做第 9 步。未出评测集。人确认之前不写库。

## chip 行有哪些

连接器是单独的 `<select>`，不和 kind chip 同一排按钮。

| 组 | 现网 |
|---|---|
| 连接器（下拉） | 选中「局域网业务协作适配器」；选项还有两条「本地 · 供应商拜访台账」 |
| 这次操作 kind chip | **销售回款 1**、**销售合同 20** |
| 混排 | 无。kind 行没有「本地 · …」 |

取消前 / 取消后 kind 行都是这两颗，没有把本地应用冒充业务表。

## 取消后表

| 项 | 取消前（改行抽屉开着） | 取消后 |
|---|---|---|
| 行数 | footer 1 · tbody 1 | footer 1 · tbody 1 |
| 首行 | PAY-2026-005 | PAY-2026-005 |
| 抽屉 | 开 · 操作：改行 | 关 |
| pending 令牌 | `pv_db5988bfb1d20012` | 空（只关这一次） |

同一对象、同一条件、同一批行。不是同对象几十行目录（X 次那次取消后曾是销售回款 20 / 首行 PAY202508027115）。

## 对照

- 已对：连接器选择与这次 kind chip 分开。`RecordsPanel` 连接器 `<select>` + `surfacedKindChips`。现网 chip 行无「本地 ·」。图 `media/records-chips-cancel.png`。
- 已对：取消只关这一次 `preview_id`；表留在取消前那张 1 行 PAY-2026-005。`dismissPreviewDrawer` 走 `displayBeforeWriteRef`，不再 `restoreRecordsList` 灌目录，也不再 `bizPreview` 现查拉全表。`main` `1358425`。
- 已对：未静默 `biz_write`，未点确认过账。硬编码 none。
- 未对：点「销售合同 20」chip 后表体是不是这次 hop 合同一侧命中（只量了回款侧取消后仍是 1 行）。
- 未对：第 9 步、评测集、审查 corpus 去留、打包、overlay 收编、决策 20/21。

截图: `media/records-chips-cancel.png`  
探针: store `internal/verify-records-chips-cancel.mjs`（不入产品仓）
