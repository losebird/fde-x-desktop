---
cursor:
  subagentId: "bc-8767ed9a-53f1-50bc-bfec-26eba052b7e7"
---

# Verify: W 写预览换成最新那一次

**hardcoded:** none  
**pass:** yes  
**origin:** not pushed  
**step 9 / eval set / corpus / packaging:** not done  
**silent biz_write:** no  
**confirmed:** no（未点确认过账）  
**429:** no  
**dismissed between hops:** no

## SHA

| 项 | 值 |
|---|---|
| daily main | `8387d40cba55c6f40bc54bd03a0bee628ed199ed` |
| HEAD | `8387d40` on **main** |
| commit | `fix(biz): latest write preview owns pending and drawer` |

cwd `/Users/zxz/Documents/ai-project/fdex测试`  
会话 `session-bff49329-9cb3-4b11-9003-b3489880d298`  
原句 `待审回款 ∩ 已到期合同`（词表+图：销售回款 ← 销售合同；`can`=现查/改行/删除/新建/过审）

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未做第 9 步。未出评测集。人确认之前不写库。

## 每跳 hop / pending / 抽屉动作

| 动作 | hop | pending | 抽屉 | rows | first |
|---|---|---|---|---:|---|
| 改行 | yes | 改行 | 改行 | 1 | PAY-2026-005 |
| 删除 | yes | 删除 | 删除 | 1 | PAY-2026-005 |
| 过审 | yes | 过审 | 过审 | 1 | PAY-2026-005 |
| 新建 | yes | 新建 | 新建 | 1 | 新单 |

改行 / 删除 / 过审 都是同一条关系链交集行（from=销售合同，steps 销售合同→销售回款）。新建带同一条 hop，预览是新单，不是父型半表。闸测 `runtime/tests/write-opening.test.mjs`：连续不同动作 pending 跟最新一次；取消只掉该 `preview_id`。

## 对照

- 已对：同一会话连续写预览 pending / 抽屉 / footer 跟最新一次。`gate.js` 不同动作换 opening；lead 用最新 hop。`main` `8387d40`。
- 已对：取消只关这一次 `preview_id`，不抹下一跳，不清 `sheetTrail`。闸过。现网未点取消。
- 已对：现网四跳都 hop 交集，未静默 `biz_write`，未点确认过账。图 `media/records-write-opening.png` 抽屉「操作：新建」。
- 未对：第 9 步、评测集、审查 corpus、打包。

截图: `media/records-write-opening.png`  
探针: store `internal/verify-records-write-opening.mjs`（不入产品仓）
