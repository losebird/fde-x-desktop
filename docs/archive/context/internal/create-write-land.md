---
cursor:
  subagentId: "bc-aee10adf-ea27-5232-bf3e-a7265d9dcc00"
---

# 三刀已按契约落地

对照已改过的 [create-write-fix-plan.md](../docs/create-write-fix-plan.md)。本地提交，未推远程。未在浏览器里点过账，手验未做。

## 改了哪些文件

闸（`runtime/vendor-overlays/dsh-lan-assist/`）：

| 文件 | 做什么 |
|------|--------|
| `relation-bind.js` | 口语值按 schema 这一格：照写 / 枚举 / 指向另一行。`$or` 只用目标 schema 上有的列。唯一一行才收 id。可空对不上不挡整笔；必填、枚举 0/多、关系多条、对不上的键挡住确认。没有 schema 时照写，避免把整笔都当成对不上。 |
| `lookup.js` | 字段带上 `required` / `allowNull: false`，确认才知道这一格能不能空。 |
| `write.js` | 新建、改行走上面的收口。确认面用解析后的值，令牌里的 patch 用要写入的值。空新建不发牌。现查回执带 `lookupNo`。 |
| `gate.js` | 确认只写人点的那一枚未使用且有变更的牌。开口里的空新建先废再写，不再按 lines 全发。四种 wrote 回执带刚写下的 no / where。 |
| `session-round.js` | 带着 no/where 的回执不是无筛选整表。无筛选列表不掐已经带上身份的回执。不拆 round-end。 |
| `index.js` | wrote 后续的现查补上刚写下的身份。 |

右边确认面（Vite，随文件热更新，未重启 5174）：

- `src/lib/biz-sheet-display.ts`
- `src/components/biz/PreviewChangesList.tsx`
- `src/components/biz/BizPreviewDrawer.tsx`
- `src/components/biz/RecordsPanel.tsx`

未绑显示「这一格对不上」。多条可先选。表上改过再确认会重新预览，再写新的那一枚。

## 测试

`node --test` 62 过 0 败：

- `runtime/tests/write-patch-relation.test.mjs`
- `runtime/tests/write-confirm-collapse.test.mjs`
- `runtime/tests/session-round.test.mjs`
- `runtime/tests/write-opening.test.mjs`
- `runtime/tests/write-hop-actions.test.mjs`

未改、HEAD 上本来就红、这次没碰：`leftover-catalog-refuse` 的口语跳转、`write-name-identity` 的「成交」对更长枚举标签、`records-align` 里三条对源码文本的快照。

## 现网

| 项 | 结果 |
|----|------|
| overlay | `cp -R` 到 `~/.dsh-fde-x/vendor/dsh-lan-assist/`。`relation-bind.js` `write.js` `gate.js` `session-round.js` `index.js` `lookup.js` 的 SHA256 与 overlay、与 `profiles/fde-x/node_modules/dsh-lan-assist` 相同（`relation-bind.js` inode `67191581`）。 |
| DSH | `POST /api/v1/ai/disconnect` 然后 `POST /api/v1/ai/connect`，`Origin: http://localhost:5174`。旧进程 **46392** 已退出。新进程 **67602**，`startedAt` `2026-09-24T14:14:31.178Z`。未调用 `/ai/reload`。 |
| BFF 4318 | **未重启**。PID **46288** 仍是唯一 LISTEN。这次没改 `runtime/server.mjs`。 |
| Vite 5174 | **未动**。PID **42443**。 |

## 手验怎么点（未做）

新开一轮会话。不要用旧预览。

1. 一句新建。照写的格子，确认面就是这句话；在右边表里改完再确认，库里应是改后的值。枚举只认 schema 选项：唯一则确认面和库都是那个选项；对不上则确认停。指向另一行：唯一才收 id，确认面是解析后的那一行；0 行可空可以空着过，必填不能过；多条先选再继续。再改一行同一关系。删除或过审用口语当条件，对不上则原行还在。
2. 一句新建、点一次确认。库里只多这一行。空 patch 不发牌。改行、删除、过审各点一次，写出的是点的那一枚。
3. 写成功后左边现查带着刚写下的 no 或 where，这一轮不是 aborted。无筛选整表不当回执。预览刚成功时左边不刷。
