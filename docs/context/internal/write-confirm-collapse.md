---
cursor:
  subagentId: "bc-6ed18618-ce89-5bef-90b1-b8843f5ee1ce"
---

# 连弹确认：按契约收口

未使用的写令牌才开「确认过账」。hall / officialRoundSheet / lastEmitted / 前端 dismissed 还在，只是不再各自冒充待确认。round-end 没拆。

本地提交 `2e1edf81`，分支 `cursor/write-confirm-collapse-e1ce`。未推远程。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/biz/write-confirm.mjs` | 令牌状态投影：open 留着 canWrite；used / expired / absent 留画面、去掉 canWrite |
| `runtime/routes/biz.mjs` | 写成功立刻把本会话 lastEmitted 收成无写权的画面；GET pending 按闸上的 `writePreview` 再投影一次 |
| `runtime/lan-assist-state-watch.mjs` | 轮询官方表时先投影，USED 之后的 SSE 不再带 canWrite |
| `runtime/biz/sheet-payload.mjs` | `writeToken` 跟着表走 |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | `previewTokenIndex`；`lookupLocked` 的现查不再被收成写动作 |
| `runtime/vendor-overlays/dsh-lan-assist/gate.js` | 过账成功把同一 opening 里还没作废的令牌一并标 used |
| `runtime/vendor-overlays/dsh-lan-assist/session-round.js` | `wrote` 之后的秘书轮记着 follow-up，下一句人话清掉 |
| `runtime/vendor-overlays/dsh-lan-assist/index.js` | `/state` 带 `writePreview`；follow-up 里工具参数是现查则锁成现查 |
| `runtime/vendor-overlays/dsh-lan-assist/slots.js` | `lookupLocked` 时不再按旧话把现查收成写动作 |
| `src/lib/write-confirm.ts` | 抽屉只在令牌未关闭、且仍有 canWrite（或过审已在目标）时开 |
| `src/components/biz/RecordsPanel.tsx` | 用上面这条；写预览不再靠浏览器里的旧 pending 跳过 GET |

## 测试

`node --test runtime/tests/write-confirm-collapse.test.mjs`（另回归 session-round、slots-enrich、connected-kind、biz.test，都过）。只覆盖这一类：

1. 开抽屉：used / expired / absent 不开；未关闭且 canWrite 才开；取消仍不开；过审已在目标、令牌还活着仍开。
2. 写成功清权：`releaseEmittedConfirm` 去掉 canWrite，行还在；投影后同一张不再开抽屉。
3. wrote 后现查不发牌：旧话里的「新增」不再把工具参数现查收成新建；`lookupLocked` 的 preview 不增加令牌。同一 opening 的兄弟令牌在成功过账后标 used。

## 现网

| 项 | 结果 |
|---|---|
| overlay | `cp -R` 到 `~/.dsh-fde-x/vendor/dsh-lan-assist/`。`write.js` SHA256 `4eecc2cb…aec6`，overlay = vendor = `profiles/fde-x/node_modules/dsh-lan-assist`（链到 vendor） |
| DSH | `POST /api/v1/ai/disconnect` 然后 `POST /api/v1/ai/connect`。未调用 `/ai/reload`。新进程 **46392**，`startedAt` `2026-09-24T11:40:04.040Z`。`GET /lan-assist/state` 已有 `writePreview` |
| BFF 4318 | 旧 **26724** 已停，新 **46288**（`node runtime/server.mjs`，cwd 本仓库，19:39:43 起，晚于 `biz.mjs` 19:36:12）。`/health` 200 |
| Vite 5174 | **42443** 未动（9 月 23 日起） |

## 还没在现网证的

没有新开会话，也没有点「确认过账」，没有看秘书 follow-up 在右边是否再弹。上面是进程与单测，不是那一下手点。

## 怎么手验

新开会话，说一句新建（带处理人也可以）。只应有一张确认。点一次：抽屉关，左边现查不再弹确认。若再弹，停在那张，把图留下。
