---
cursor:
  subagentId: "bc-9ec2818b-ce90-5118-9b44-d3ffa75249ba"
---

# Verify: 非目标侧 kind chip = 这次 hop 命中

**pass:** yes  
**hardcoded:** none  
**origin:** not pushed  
**silent biz_write:** no  
**confirmed:** no（未点确认过账）  
**429:** no  
**step 9 / eval set / corpus / packaging / overlay 收编 / 决策 20/21:** not done

## SHA

| 项 | 值 |
|---|---|
| daily main | `85d38878b9c8bcefb3d0d4d29e24bef874f9fd69` |
| HEAD | `85d3887` on **main** |
| commits | `f6845e3` hop `from.rows` = 该 kind 命中；`65e0cb2` 有命中就可点；`6787a77`/`85d3887` 点 chip 后 pending SSE 不得把表抢回目标侧 |

cwd `/Users/zxz/Documents/ai-project/fdex测试`  
会话 `session-e0e24f70-96f8-4e0f-8ab6-45b32bad4cf7`  
原句 `待审回款 ∩ 已到期合同`（词表+图绑定：销售回款 ← 销售合同）  
闸注入：no

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未做第 9 步。未出评测集。人确认之前不写库。为加载 overlay 对 DSH 做过 disconnect/connect（pid 27756 → 4564），5174 未杀。

## 点非目标侧 chip

| 项 | 现网 |
|---|---|
| 目标侧 chip | 销售回款 1 |
| 非目标侧 chip | **销售合同 1**（不是 20，不是目录页长） |
| 点合同侧后 kind | 销售合同 |
| 点合同侧后行数 | footer 1 · tbody 1 · chip 1 |
| 点合同侧后首行 | HT-2026-005 |
| 是这次 hop 命中 | **yes**（pending `from.rows` 1 / 首行同一号；左 AI 关联合同同一号） |
| 是目录/半表 | **no**（不是连接器全表，也不是 20 行页） |

点回目标侧：销售回款 · footer 1 · tbody 1 · 首行 PAY-2026-005。仍是这次交集。

## 对照

- 已对：chip = 这次操作该 kind 命中，不是 catalog。闸 `from.rows` 1 ≠ parent 半表；现网点合同侧表体 1 行 HT-2026-005。`RecordsPanel` `operationKindHitSheets` + hop `keepParentsForChildren`。图 `media/records-kind-chip.png`。
- 已对：点回目标侧仍是这次交集 1 行 PAY-2026-005。
- 已对：未静默 `biz_write`，未点确认过账。硬编码 none。
- 未对：第 9 步、评测集、审查 corpus 去留、打包、overlay 收编、决策 20/21。

截图: `media/records-kind-chip.png`（合同侧选中、共 1 条、首行 HT-2026-005）  
探针: store `internal/verify-records-kind-chip.mjs`（不入产品仓）
