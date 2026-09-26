# Verify: V 写动作现网 hop

**hardcoded:** none  
**pass:** no  
**failCode:** `delete-pending-not-action`（过审/新建未走，失败即停）  
**origin:** not pushed  
**step 9 / eval set / corpus / packaging:** not done  
**silent biz_write:** no  
**confirmed:** no（未点确认过账）  
**429:** no

## SHA

| 项 | 值 |
|---|---|
| daily main at start | `4555a37` |
| HEAD | `08baa98271358925da8c22ae0a352238677edee1` |
| dismiss fix | `e62c7bb` then `08baa98` on **main**（不是只留旁支） |

cwd `/Users/zxz/Documents/ai-project/fdex测试`  
会话 `session-9e84a296-a4f7-4f05-b778-1583611331e0`  
原句 `待审回款 ∩ 已到期合同`（词表+图：销售回款 ← 销售合同；`can`=现查/改行/删除/新建/过审）

产品仓未推 origin。探针未进产品仓。未杀 pnpm 5174。未 git add 探针。未做第 9 步。未出评测集。

## hop yes/no per action

| 动作 | hop | rows | first | 说明 |
|---|---|---:|---|---|
| 改行 | **yes** | 1 | PAY-2026-005 | pending from=销售合同 · hopWhere yes · steps 销售合同→销售回款 · tbody/footer/chip 都是 1 · 抽屉改行 · 未过账 |
| 删除 | **yes（左 AI）** / pending **no** | 表体 1 | PAY-2026-005 | 左 AI：拟删同一行、preview_id `pv_673cb8dd3aa12fc8` 未使用；右表仍是交集 1 行；抽屉仍是改行；GET pending-sheet 超时后空 |
| 过审 | 未走 | — | — | 删除 pending 没换成删除，失败即停 |
| 新建 | 未走 | — | — | 同上 |

闸测 `runtime/tests/write-hop-actions.test.mjs`：改行/删除/过审/新建 都 hop 交集，不是父型半表。这不是现网过关。

## 改行（现网过）

- 左 AI：命中 PAY-2026-005 / HT-2026-005，preview_id `pv_c563ef2cf50fbc87` 未使用
- 右：chip `销售回款1` · footer `共 1 条` · tbody 1 · first `PAY-2026-005`
- pending hop=yes from=销售合同

## 删除（现网半过，停）

左 AI 口述 hop 到同一行并给出删除令牌，未 `biz_write`。右表仍是该交集 1 行，**不是**半表。  
仍差：同一会话写预览会并进同一个 opening，pending/抽屉 action 停在改行；点取消还会把表拉回别的缓存（曾出现客户 22）。为拆 opening 清 hall 时，pending-sheet 对删除这次是空。

## 产品改动（main）

- `e62c7bb` hall `/write/cancel` 只清匹配的 preview_id  
- `08baa98` hall 已空时不再 cancel，避免抹掉刚落到的下一跳写预览  

未点确认过账。4318 在 reload 后由新 runtime 拉起（未杀 pnpm 5174）。

## 对照

- 已对：改行现网走与现查同一条关系链，预览是交集那一行。`write.js` hop 环 + `slots.js` speech enrich；图 `media/records-write-hop.png`。`main` `08baa98`。
- 已对：删除现网 AI 预览也是同一行 PAY-2026-005，未过账。图左侧。
- 仍差：删除 pending/抽屉 action 不是删除；过审/新建现网未走。
- 未对：第 9 步、评测集、审查 corpus、打包。

截图: `media/records-write-hop.png`  
探针: store `internal/verify-records-write-hop.mjs`（不入产品仓）
