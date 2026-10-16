# 连弹「确认过账」：根因

对照 [新建三次确认](double-confirm-plan.md)、[增删改审手测集](biz-write-eval.md)。只查因。新建、改行、删除、过审走同一条确认。

## 一句话

**不是套件太多，也不是层数本身。** 写令牌只在闸口有 `used`，开抽屉却听 hall / round / BFF `lastEmitted` / 前端 pending 各活各的。没有「未使用的写令牌 → 至多一张确认」这条契约，所以一次人话会连弹。

## 你那三次（现网已对上）

会话 `session-0b9d3ea9-…`，工单新建。

| 你看见的 | 令牌 | 事实 |
|---|---|---|
| 第一张，你点了 | `pv_5348ce5fe857e9df` | 18:36:46 **写进库了**（BFF 200） |
| 马上第二张，报已经用过 | **还是 `pv_5348`** | 写成功后 BFF 还握着带 `canWrite` 的 lastEmitted，hydrate 又打开同一张。再点 → USED |
| 左边现查完第三张 | **新令牌** `pv_e34436d10b24df3d` | 秘书 wrote 之后这一轮又打出 `biz_preview` **新建**，round-end 再推确认 |

改行、删除、过审同一套：成功后 hydrate 能复活旧令牌；follow-up 现查能再落成写预览。

## 为什么不是套件 / 层数

路径上大约 9 段（词表 → 槽 → 令牌 → hall → 轮次 → 工具 → BFF → 右栏），是一条流水线，不是 9 套确认产品。层深会放大不同步，但不会自己变成三次点击。

会连弹，是因为：

1. **谁能开抽屉** 看的是 sheet 上有 `preview_id`、有变更、没 dismiss。**不看**闸里这枚令牌是不是已经 USED。
2. **写成功**清了闸的 hall，**不清** BFF `lastEmitted`。GET pending 还优先吐这张旧写预览。
3. **过账后秘书跟一句** 开新 turn。模型再 `biz_preview`，slots 仍可能收成写动作，于是 **新发一张令牌**，第三张确认。

## 为什么会有这么多份 pending

不是一开始就设计成四套确认。每一份都是后来为了**别的问题**加上的，开抽屉却从来没规定「只认未使用的那一枚令牌」。

| 这份 | 当初要解决什么 | 为什么会变成「又能确认」 |
|---|---|---|
| **闸令牌** `write.js` tokens | 预览发牌、过账验牌、用过作废。这是唯一真正管「能不能写」的 | 它有 `used`。开抽屉不读它 |
| **hall** `pendingWrite` / `pendingSheet` | 给秘书留这一笔：多行 opening、合并预览、给 IM/`/state` 一张表 | 写成功会清 hall。但旁边还有别的副本 |
| **round** `officialRoundSheet` | 一轮工具打完只留一张「官方表」，避免 leftover 现查盖掉写预览 | BFF watch **只盯这一张**去 SSE。它不管令牌死活 |
| **BFF `lastEmitted`** | SSE 会断（重连、重启）。GET pending 要能把「上次推给右栏的那张」再吐出来 | 写成了带 `canWrite` 的写预览缓存。hall 清了它还在，hydrate 就再开抽屉 |
| **前端 pending + dismissed + 抽屉** | 右栏要马上画、取消后别被 SSE 再打开（W24） | dismiss 只在浏览器 sessionStorage。服务端令牌还活着，GET 一来又开 |

所以会多，是**职责堆叠**：安全要令牌，秘书要 hall，左右对齐要 round，断线要 lastEmitted，取消要前端 dismissed。每一层都复制了一份「待确认」的样子，**没有一层被指定为「开抽屉的唯一依据」**。

你看见连弹，不是四个人同时点确认，是写完之后 **lastEmitted 还当这张能确认**（第二张），秘书下一轮 **又 mint 新令牌**（第三张）。

## 能不能只留一份、把另外三份删掉

**不能把 hall / round / lastEmitted / 前端当四套同功能删掉三套。** 苦果是「开确认」被复制了，不是这四份活都多余。

硬删会拆掉当初那件事：

| 若删掉 | 会拆掉什么 |
|---|---|
| 闸令牌 | 没人验牌。谁都能写。 |
| hall | 秘书、IM、`/state` 丢这一笔 opening；多行合并预览没处放。 |
| round `officialRoundSheet` | leftover 现查再盖掉写预览。官方表刚为这个留下。 |
| 前端 dismissed | 取消后再被 SSE 打开（W24 会回来）。 |

`lastEmitted` **带着 canWrite 当写预览缓存**，这一截才是该清的冗余。断线重连仍要「上次画过的表」，但不该再握写权。

该留的「一个」是：**未使用的写令牌 = 唯一开「确认过账」的依据。** hall / round / lastEmitted / 前端只许当这枚令牌的投影：画表、给秘书说话、重连补画面、记住取消。令牌 USED 或过期后，它们都不得再冒充待确认。

这和 [准备怎么收](double-confirm-plan.md) 三刀是同一件事，不是再起一套、也不是四选一删库。

## 已按契约落地

代码已按上面这一条收，没有另起一套，也没有删 hall / round / lastEmitted / 前端。本地 `2e1edf81`，现网闸 overlay 与 BFF 已换上。

**还没**在现网新开会话点「确认过账」，所以「一句新建只弹一张、点完左边现查不再弹」这一下仍未手证。

## 查的是谁

[Audit write confirm state machine](bc-be3309bb-3280-5b82-93e2-997f588e2480)、[Audit write stack layers](bc-254e07d5-801d-5286-a758-ac57c7c64f83)、[Audit live triple confirm](bc-94f53eba-0e68-5c30-ba2e-5307448bd7a5)。
