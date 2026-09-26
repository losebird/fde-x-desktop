---
cursor:
  subagentId: "bc-bf17fe32-4fe1-5ab5-b3ab-a36a06f177f4"
---

# 右边跟这一句查到的表

`6af8aa2a`，分支 `cursor/this-utterance-sheet-77f4`（已推远程）。

右边只认这一句已经对上的现查，或还没用来确认的改行。查到行，这一句还没说完就上台。上一句的表让开。同一句里的空目录、无身份现查盖不掉已经对上的表，也盖不掉还开着的改行抽屉。没问新的现查时，重连仍把没用过的改行还回来。问了下一句现查，改行让开。

大厅仍给秘书说话。回合仍负责同一句里哪一枪算数。没有再加一张「当前表」。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/session-round.js` | 这一句对上的行（或未用的写预览）立刻成为交出去的表。空目录、不带刚写下身份的跟进现查不上台 |
| `runtime/biz/connected-kind.mjs` | 重连：没问新的现查，交回未用的改行。下一句对上的现查换掉它。无身份列表不当回执 |
| `runtime/lan-assist-state-watch.mjs` | 发出去的官方表带上这一次的表面编号 |
| `runtime/server.mjs` | 先记下表面，再把编号放进推送 |
| `runtime/routes/biz.mjs` | 记下表面时把编号交回去 |
| `src/lib/biz-records-history.ts` | 钉住浮现历史时，空编号不再丢掉一张真的新现查。目录倾倒仍留在点中的那一次 |
| `src/components/biz/RecordsPanel.tsx` | 新的现查上台时，钉跟着让开。未使用的写令牌仍按原样开抽屉 |

测试：

| 文件 | 做什么 |
|---|---|
| `runtime/tests/session-round.test.mjs` | 4 行在回合结束前换掉上一句改行；同一句空目录不盖；写跟进无身份不上台 |
| `runtime/tests/connected-kind.test.mjs` | 下一句现查换掉改行；没问新现查时重连仍是改行 |
| `runtime/tests/records-align.test.mjs` | 空编号不丢掉有身份的现查 |
| `runtime/tests/official-surface-id.test.mjs` | 新表推送带着表面编号 |

## 测试

先失败，再过。失败时：4 行还停在上一句改行；同一句空目录把改行换掉；写成功后的无筛选表被收成官方；重连认改行、不认下一句现查；钉住历史时，空编号把有身份的现查丢掉。

过后：

`node --test runtime/tests/session-round.test.mjs runtime/tests/connected-kind.test.mjs runtime/tests/official-surface-id.test.mjs`

再加上 `pinned history` 那一条，和 `runtime/tests/write-confirm-collapse.test.mjs`。未使用的写令牌仍只在没用过时开抽屉。

覆盖的是：

- 上一句改行还在，这一句现查 4 行，回合还开着，右边已经是这 4 行
- 同一句后面的空目录不换掉这 4 行，也不换掉还开着的改行
- 没问新的现查：重连交回改行。问了，交回现查。无身份的「库里已改上」不换掉改行
- 写成功后的跟进，只有带着刚写下的身份才上台
- 浮现历史钉着时，空编号的真现查不丢；空目录仍停在点中的那一次
- 新的官方推送带上表面编号

## 部署

回合文件在 overlay 里，所以重连了 DSH。看表的推送和重连读法改了，所以重启了 4318。Vite 没动，业务记录那一页自己热更新了。

旧 BFF **51660** 在 SIGTERM 后卡住、不再听端口，已 SIGKILL。新 BFF **63367**，tmux `bff-4318`，仍听 4318。Vite **42443** 仍听 5174。

`POST /api/v1/ai/disconnect` 然后 `POST /api/v1/ai/connect`，`Origin: http://localhost:5174`。旧 DSH **51709** 已随 BFF 退出。新 DSH **63427**，`startedAt` `2026-09-25T04:43:55.306Z`。没有 `POST /ai/reload`。

checkout overlay、`~/.dsh-fde-x/vendor/dsh-lan-assist`、`profiles/fde-x/node_modules/dsh-lan-assist`（与 vendor 同一 inode）哈希一致。

| 文件 | SHA256 |
|---|---|
| `session-round.js` | `a3e313e7a1a68a07cadfc02d8c87a3d1b64d678158541a731b05494596e29de1` |

## 手验怎么点

同一会话先停在客户改行，再说「恒通电子有哪些工单？」：

1. 右边马上是这 4 张工单，不用等这句话说完。不是刚才那张客户改行。
2. 这句话里如果又打出空目录，右边仍是这 4 张。
3. 改行抽屉还开着、确认还没点：先别问新的现查，断开再连上，右边仍是这张改行，抽屉还在。问过工单之后再连，右边是工单。
4. 点浮现历史里的那次客户改行，表回到那一次。再问工单，又换成工单。
5. 写成功后的跟进，只有带着刚写下的那一行才上台。没有筛选的整表不是回执。
