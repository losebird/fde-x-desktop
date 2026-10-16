---
cursor:
  subagentId: "bc-eb755a43-c9f3-5eca-af96-3567ff2c74b5"
---

# 回退按行主键找：预览已对上恒通，库还没写回

`cf332597`，分支 `cursor/rollback-by-pk-74b5`（已推远程）。

回退只认历史里的对象和行主键 `receipt_id`。原话格空着，不再塞「回退」。找行闸因此不会把这两个字当成名字。确认写回用同一条主键。0 行仍是失败。没有行主键就说这一行对不上，不去名称里撞，也不倒整表。

口语改行没动：人话里剩下的名字仍能压过已经填上的号。

刚对 CUST2056 做了预览，没有点确认。对上深圳恒通电子这一行，主键 `371712729939987`，备注仍是 `测试修改`，预览要把备注写回 `active`。原话格是空的。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/biz/audit-lookup.mjs` | 回退预览的唯一入口。对象 + `receipt_id`。没有主键就返回「这一行对不上」。不写 speech，不把当时的 where/hop 再拿来选行 |
| `runtime/routes/biz.mjs` | `/rollback/preview` 只走上面这一口。0 行仍报没找到这一行 |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | 预览用主键找中之后，确认写回仍用这条主键，不改成业务编号 |
| `src/lib/biz-list-query.ts` | 浮现历史的条件标签不再把原话格里的「回退」当成这是哪一次。动作仍从历史动作读 |
| `runtime/tests/rollback-by-pk.test.mjs` | 先失败再过的那一组 |
| `runtime/tests/audit-lookup.test.mjs` | 预览体不再带「回退」，也不再重放 where |

写回审计仍把空原话格当成「不是当时那句」，成功后换回原来那句。审查原文见到空，或旧记录里的「回退」，都不当成当时原文。

## 测试

`node --test runtime/tests/rollback-by-pk.test.mjs`：8 项过。

同一批里 `audit-lookup`、`corpus`、`write-lookup-key` 过。`write-name-identity` 里「成交」那条在改之前就已经失败，不是这次。

覆盖的是：

- CUST2056 这种回退：查找键是主键，滤法里没有 `name $includes 回退`
- 工单换一把主键，同样走这一口
- 没有主键：不给名单，也不打无筛选的 list
- 口语「把客户恒通改成测试修改」：已填的 CUST2056 仍换成恒通
- 确认写回的 update 滤法是 `{ id: 主键 }`
- 空原话格、以及旧的「回退」记号，都不当成当时原文

## 部署

BFF 路由改了，所以重启了 4318。Vite 没动。

旧 BFF **46288** 在 SIGTERM 后卡住、不再听端口，已 SIGKILL。新 BFF **51660**，tmux `bff-4318`，仍听 4318。Vite **42443** 仍听 5174。

`POST /api/v1/ai/disconnect` 然后 `POST /api/v1/ai/connect`，`Origin: http://localhost:5174`。旧 DSH **39066** 已随 BFF 退出。新 DSH **51709**，`startedAt` `2026-09-25T03:26:36.325Z`。没有 `POST /ai/reload`。

checkout overlay、`~/.dsh-fde-x/vendor/dsh-lan-assist`、`profiles/fde-x/node_modules/dsh-lan-assist`（与 vendor 同一 inode）哈希一致。

| 文件 | SHA256 |
|---|---|
| `write.js` | `bd5704319a05e09979f9cabe1b79a7c336fc1bfb4dca457e416f6af522108ee3` |

## 手验怎么点

预览已经打中，确认还没点。操作记录里点 CUST2056 那条改行的回退：

1. 预览对上深圳恒通电子，备注 `测试修改` → `active`。不要再报对不上「回退」。
2. 点确认。库里 `biz_customers` 这条的备注回到 `active`。
3. 审查这条回退：不当「回退」两个字是当时原文。当时那句仍是「改客户 CUST2056 备注改成测试修改」。

没有主键的老记录：应说这一行对不上，不要列出没筛选的整表。

口语改行抽一条「恒通」压过已经填上的客户号，确认还能换。
