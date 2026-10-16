---
cursor:
  subagentId: "bc-1aaf16b4-dfce-5d67-94fe-806187a4c607"
---

# 右边为什么长出两张「当前表」

**两张表是后来叠上去的。** 大厅 `pendingSheet` 给秘书马上用这一笔。回合 `officialRoundSheet` 给「一句人话打出好几枪」留最后一张，免得目录倾倒或同号现查盖掉写预览。右边被接到回合表之后，成功的 hop 现查也要等这句说完才算数，上一句的改行就占着屏幕。

这一份只写这两张表当初各管什么、为什么会抢同一块屏。这一下怎么掉下去，见 [hop-sheet-stuck-root.md](hop-sheet-stuck-root.md)。原则见 [one-authority-no-copies.md](../principles/one-authority-no-copies.md)。

## 1. 两张表原来各管一件别的事

| | 大厅 `pendingSheet` | 回合 `officialRoundSheet` |
|---|---|---|
| 当初的活 | 秘书、IM、`/state`、工具回执要**马上**拿到这一笔：合并预览、开口、记账 | 一句人话里往往连打好几下 `biz_preview`。过程枪不是这句的结果，槽位上的最后一写也不是 |
| 谁写 | 闸。现查一成功就换上（`gate.js` 现查分支，账本「现查进业务页」） | `noteToolSheet` 只放进 `candidate`，`servedSheet` 在回合关上之前仍交上一张 `official` |
| 现在谁用它画右边 | 工具回执自己带着这张表 | BFF watch **只盯这一张**发 `biz.sheet.pending`（测试名：`AI official handoff does not paint from the shared pending slot`） |

回合文件头写的就是这个分工：一句人话 → 一张官方表；过程预览不是官方；槽位最后一写不是这一句的结果。

大厅后来还在，因为秘书说话、多行 opening、给 IM 一张表，这些活还在。写确认那次已经记过：hall 是秘书的当前开口，清掉它秘书就没表可说（[write-confirm-root-cause.md](write-confirm-root-cause.md)）。

回合后来还在，因为这些枪必须分得开：

- 过程枪不交班，官方只在回合关上时交（`process tool results are not handed; official is only on round close`）。
- 回合结束交的是这一句的 hop，后面的无过滤目录倾倒不算（`turn end hands this-round hop, not a later leftover dump`）。
- 同一句里、同一种、去查正在改的那一行，算 leftover，官方留下改行（`write leftover 现查 does not become official`，写预览带 `picked`）。
- 空表、第三种空表，不得偷走这一句已经对上的关系。

§9 要的是另一件事：左边这句拿到哪些行，右边就是同一张表。大厅按这个时机写。回合按「等这句的枪都打完」写。两份都答「右边现在画哪张」，所以成了两个活权威。

## 2. hop 现查要等回合结束，是因为「等最后一枪」被接成了画屏

等，不是为了让新的一句现查输给上一句改行。等，是为了在**同一句里面**分清哪一枪算数。`noteToolSheet` 一律 `emit: false`。候选人换了，`servedSheet` 仍交 `official`。`startRound` 把上一句的 `official` 抄进新回合。Watch 每秒读的是 `servedSheet`，读到变了才发，来源标 `round-end`。

所以新的一句 hop 现查，在这句关上之前，上不了 `servedSheet`。它被当成「这句可能后面还有一枪目录」。上一句的改行是上一回合关上时已经写入的 `official`，新回合开着的时候屏幕继续交它。

同回合里其实有一条替换：`explicitLiveLookupSupersedesWrite`。没有写令牌的现查，可以换掉**这一句里**还开着的、语音绑上去的写预览，不走 leftover 取消（`speech-bound 新建 in-round is superseded by explicit 现查`）。换的是 `candidate`。测试只断言候选人变成现查，不断言 `servedSheet` 在中途变了。要等 `closeRound` 把候选人抄进 `official`，watch 才看得到。

这条替换够不到上一句。上一句的改行已经在那一句结束时收成 `official`。新的一句进来时，候选人是空的，supersede 无对象可比。`closeRound('wrote')` 还会把开着的候选人清掉，专门留给秘书跟进，不把跟进现查收成官方。

## 3. 交接之后，GET 认最后一张带令牌的改行

`sheetForOfficialGet` 的注释写明了场合：会话结束交接之后的 GET / hydrate，交上次交出的那张，不交后来的现查槽。

`isHumanWritePreview`：有 `preview_id`，且动作不是现查。同会话的 last 只要是这种，函数直接返回它，后面的官方现查不看。测试 `official GET prefers last handed and never takes hall process`：官方已经是 hop 现查，last 仍是带 `pv-human` 的改行，GET 返回改行。

这张偏好是为确认单留的。写成功会清大厅，不清 BFF `lastEmitted`。断线、重连、hydrate 要能把「上次推到右栏的那张」再吐出来。若后来的现查（秘书「库里已改上」、大厅过程枪、后一页列表）能盖过它，人正在确认的改行会丢，或者清掉之后又被 hydrate 打开。写确认那次的冗余是：`lastEmitted` 还带着 `canWrite`，自己又能开抽屉。画表这一侧留下的是：带令牌的改行，比后来的官方现查更有资格当「重连时的那张表」。

## 4. 浮现历史的钉，把「没有 surfaceId」当成「不是我点的那条」

§4：点下拉里某一条，表必须换成**那一次**的行。打开着的写预览不能挡住这次切换。下一条推送不能把人从点中的那条拽回最新表。`records-align` 里的旧bug 是：下一条 SSE 先清 pin 再 apply。所以 `biz.sheet.pending` 的处理函数里禁止把 pin 清掉（`RecordsPanel keeps history pin…`）。

`shouldBlockIncomingSheetForHistoryPin`：已经钉住时，进来的 `surfaceId` 空，或和钉的不一样，就挡。测试把 `undefined` 算挡。空 id 被当成「这不是那条」，这样一次没有身份的刷新换不掉人选中的历史。

回合结束那次推送，构造上就没有 `surfaceId`。Watch 的 `emitOfficialSheet` 调用 `emitBizSheetPending` 时不传它。表面行在发出之后才插入，`server.mjs` 的 `onPendingSheet` 用 `emitEvent: false`，不再发第二次。面板先看到的那条事件，id 是空的。钉还在的时候，一张真的新表和一次 stray 刷新长得一样，先被挡下。钉只在人点历史时写上（`loadSurface`）。这次有没有点过，日志里没有。挡得住，是因为空 id 这条规则在；不是因为已经证明当时钉着。

## 5. 同一条「一份结果、两处都能做主」

是。用户结果换了。

写确认问的是谁可以开「确认过账」。权威是闸上那枚未使用的写令牌。`lastEmitted` 带着 `canWrite` 自己又能开，那一截是冗余。大厅、回合、lastEmitted、前端取消名单各自还要留着，当投影。

这一次问的是谁可以画右边的表。

- 大厅仍能马上答：工具回执里的 `sheet` 就是它刚写上的 `pendingSheet`。
- 回合要等这句关上才答，而且 watch 规定只准它答，免得过程枪盖掉写预览。
- `sheetForOfficialGet` 还能再答一次：交接后的 GET 认带令牌的改行。
- 浮现历史的钉还能再否一次：空 `surfaceId` 就当不是这条。

写预览坐在官方表和 lastEmitted 里，新的现查要等回合关上才能拿走屏幕，就是这一种违规。大厅的秘书开口、回合的 leftover 过滤、历史钉「别把人从点中的那条拽走」，这些别的活都还在，该留下当投影。能单独决定右边画哪张的那几截，是并排的权威。

没有改产品。
