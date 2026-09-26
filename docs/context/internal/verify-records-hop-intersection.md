---
cursor:
  subagentId: "bc-c3b01a5b-d699-5722-a4ad-166d5dc8a64c"
---

# Verify: 跨对象 hop 交集 vs 业务记录

**hardcoded literals:** none
**pass:** no（sheet-rows-not-footer · 表体 9 行 ≠ footer 1）
**step:** I only（未重做 G/H；写动作 preview 仍是 1 行 hop，不是 G/H 回归）

## SHA

| 项 | 值 |
|---|---|
| daily main | `635787a5a3f534f30cc762415c9ddc8b5de15c0c` |
| hop ancestor 216b45d | **yes** |
| hop 是否发生（现查 pending） | **yes** |
| pending hopWhere | **yes** |

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未静默 biz_write。未编造 AI 条数。

## I · 原句再验（5174 · cwd `/Users/zxz/Documents/ai-project/fdex测试` · 会话 `session-c4735df2-06ce-4c92-bff2-a74fbf863854`）

截图同一帧：左 AI `待审回款 ∩ 已到期合同 = 1 张`（PAY-2026-005）；右 chip `销售回款 1`、横幅 `AI 刚查了 销售回款 · 1 行`、footer `共 1 条`。表体却是 9 行，首行 `PAY202407106181` 已确认，不是交集那一行（PAY-2026-005 在表底）。

| 探针 | rowCount | first | hop |
|---|---:|---|---|
| Ace 原句 gate | 1 | PAY-2026-005 / 待审 | yes from=销售合同 steps=销售合同→销售回款 |
| leftover remap gate | 0 | leftover=合同 NOT_FOUND | no |
| 登记全称对照 | 1 | PAY-2026-005 / 待审 | yes from=销售合同 |
| 单侧 target catalog | 20 | PAY202508027115 | no |
| pending | 1 | PAY-2026-005 / 待审 | hopWhere=yes from=销售合同 steps=销售合同→销售回款 |
| 面板 footer | 1 | chip: 销售回款1 |
| 横幅 | 1 | AI 刚查了 销售回款 · 1 行 |
| 表体 tbody | 9 | first=PAY202407106181 已确认 |
| 左侧 AI 条数 | 1 | 口述「= 1 张」「目前就这一张」 |

- **speech（Ace 原句）:** 待审回款 ∩ 已到期合同
- **mentioned kinds in speech:** 销售回款、销售合同
- **target candidates (graph):** 销售回款、销售合同
- **pending speech:** 待审回款 ∩ 已到期合同
- **preview error:** none
- **connect:** connected=true pid=38823
- **rateLimited:** no（不是 429 / upstream_cooling）

## 写路径（preview only）

词表 can=改行、删除、新建、过审。对照只来自词表 can + 图。未静默 biz_write。

- 改行: hop=yes kind=销售回款 rows=1 first=PAY-2026-005 from=销售合同 steps=销售合同→销售回款 previewOnly=yes
- 删除: hop=yes kind=销售回款 rows=1 first=PAY-2026-005 from=销售合同 steps=销售合同→销售回款 previewOnly=yes
- 过审: hop=yes kind=销售回款 rows=1 first=PAY-2026-005 from=销售合同 steps=销售合同→销售回款 previewOnly=yes
- 新建: hop=yes kind=销售回款 rows=1 first=新单 from=销售合同 steps=销售合同→销售回款 previewOnly=yes

写动作 hop 仍是交集那一行，不按 G/H 回归重做。

## 根因（停）

过关句要 **表 = 左 AI 条数 = 交集命中**，pending 有 hop。

已对：pending / gate / 左 AI 口述 / chip / footer / 横幅 都是 1，hop yes。  
仍差：业务记录 **表体 9 行**，首行不是 pending 的 PAY-2026-005。chip/footer 说 1，表不是那一张。

失败码 `sheet-rows-not-footer(tbody=9, footer=1)`。未改产品。等批。

**证明脚本：** store `internal/records-hop-intersection-proof.mjs`（不入产品仓）。

截图: `media/records-hop-intersection.png`
