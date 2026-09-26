---
cursor:
  subagentId: "bc-a7b9cf8e-3869-59cc-ab8a-8830e51dda2a"
---

# 按列去库里比：已接上，未手证

本地 `f515b03c`，分支 `cursor/column-value-match-da2a`（已推远程）。

人话点了哪一列，就只查这一列的现网值。先等值，0 条再包含。引号里的「故障 / 紧急 / 客户」不再另加筛选，也不再跳到客户。对上多行先选。0 行说这一列对不上，不再留上一张单。

词表没多这句描述。没写死工单、问题描述。浏览器里还没点过删除。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/slots.js` | 人话列名对 schema 标题或字段名。文本列的 where 从这里留下。引号里的字不再进枚举、跳边、剩名。列名对不上，不拿剩名去扫别的型 |
| `runtime/vendor-overlays/dsh-lan-assist/where-pass.js` | 文本列过滤：等值，或 `$includes` |
| `runtime/vendor-overlays/dsh-lan-assist/resolve.js` | 同一条：先等值再包含 |
| `runtime/vendor-overlays/dsh-lan-assist/lookup.js` | 现查先等值，0 条再包含 |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | 0 行说这一列对不上。多行先选，不发删除牌 |
| `runtime/vendor-overlays/dsh-lan-assist/gate.js` | 这一列 0 行时换掉上一张单 |
| `runtime/tests/column-value-match.test.mjs` | 先失败再过的四条，加过滤和空表 |

`modelWhereAgreed` 仍是留下 where 的那一处。文本列对上就留。枚举不从这里再抄一份，仍只走枚举命中。关系列不改成包含。

## 测试

`node --test runtime/tests/column-value-match.test.mjs`：6 项过。改之前 5 项失败（枚举那条本来就过）。

- 引号里的问题描述：where 是 `description` 这一格，值是那句，没有类型/优先级，没有跳客户，没有 `no=胡文`。
- 引号里的故障、客户：不加筛选，不跳。
- 列名对不上（备注）：不拿「胡文」去扫客户。
- 优先级仍要枚举命中。`not-real`、整句都留不住。`紧急` 仍是 `urgent`。
- 过滤先等值，再 `$includes`。多一个句号的格子，等值不过、包含过。
- 这一列 0 行：上一张单换掉，话是「这一列对不上」。

同一批里 `slots-enrich`、`hop-plan`、`where-pass-labels`、`write-lookup-key`、`write-hop-actions`、`biz-where`、`nocobase-path` 过。原先就失败的两项没动：`leftover-catalog-refuse` 的 spoken leftover，`write-name-identity` 的「成交」改写。

## overlay

抄了上面 6 个 js。没有 `POST /ai/reload`。没有重启 4318，没有动 5174。

checkout overlay、`~/.dsh-fde-x/vendor/dsh-lan-assist`、`profiles/fde-x/node_modules/dsh-lan-assist`（同一份 vendor）哈希一致。

| 文件 | SHA256 |
|---|---|
| `slots.js` | `17a1b9cc166a020dbaa6e8235f2f45170ce284dfc4d139cc8316fa0f049f1f3a` |
| `where-pass.js` | `3b7c7bd73ce660d3c1d6fa662855b9cbecd077f2dd5e17f2f2144ed157c0b04f` |
| `resolve.js` | `790fb2592465a842b56c71483d9032f90493e744413f87294f75eaa33c7a4abb` |
| `lookup.js` | `e0730f8c2ba024afe76b8ce3feeda43af94bde7229b7e608eee635f8147e5881` |
| `write.js` | `840a1c397465824b6de6f0d9d4f3edc9dc3192f7da2ef6637caa6501d7fe3428` |
| `gate.js` | `081bf15ee95a3795be6726022136cfa6095de206fb6d6cae4a76d40578ab25cb` |

`POST /api/v1/ai/disconnect` 然后 `POST /api/v1/ai/connect`，`Origin: http://localhost:5174`。旧 DSH **86898** 已退出。新 DSH **99009**，`startedAt` `2026-09-24T18:08:03.279Z`。BFF **46288** 仍听 4318。Vite **42443** 仍听 5174。

## 手验怎么点

未手证。新开会话，用那句描述删：

把问题描述是「客户胡文今天12点电脑故障紧急保修，现在已处理完成」的那笔工单删除。

1. 预览对上库里问题描述包含这句的行。库里是 2 行（多一个句号），先选，不要直接删，也不要报对不上「胡文」。
2. 词表里不会多出这句描述。
3. 选一行再确认，删的是选中的那行。
4. 换一句对不上的描述：说问题描述这一列对不上，右边不要还停在上一张「测试新增功能」。
