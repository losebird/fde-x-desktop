---
cursor:
  subagentId: "bc-8548a0ab-2ad7-549f-a378-6cc80624f6cb"
---

# 重载只留一套 BFF + 一套 DSH

**灯已接通。** `GET /api/v1/ai/status` 现网 `connected: true`，`pid` 就是正在听业务口的 DSH，且它的父进程就是听运行口的那份 `runtime/server.mjs`。one-bind overlay 没动。未推远程。

对照 [重载核心怎么收](core-reload-fail-plan.md)、[overlay 重载后实况](../internal/overlay-reload-check.md)。事实不另编：Ace 重载后 overlay 已刷上；听运行口的是新 BFF，DSH 却挂在更早的 `server.mjs` 上，所以灯是 `connected: false`、`pid: null`。

## 第一性原理

一次重载只能留下 **一套 BFF + 一套 DSH**。对外听运行口的那个，必须就是 spawn DSH 的那个。旧 server / 旧 DSH 先杀掉再拉。灯跟这份活进程走，不拿写死的 pid/端口当契约。

## 代码上改了什么

仓库分支 `cursor/reload-single-bff-f6cb`，提交 `0755e1dc`。

| 点 | 做法 |
|---|---|
| 回收 | 新模块 `runtime/reclaim-runtime.mjs`：按 **当前** 运行口、profile、业务口、pid 文件找残留；杀掉别的 `runtime/server.mjs` 和它们的孩子。不写死端口号。 |
| 听上之后 | 新 BFF 只清 **同一运行口** 的另一份 server 及其子进程，不清别的 profile（避免测试/对端误杀）。真正拉 DSH 时再扫本 profile 残留。 |
| 重载 | 不再「先再 spawn 一份再关自己」。监督下只 `close()`。无监督则 `scripts/runtime-respawn.mjs` 等旧 pid 死、口空，再拉一份。 |
| `close()` | 停 DSH、掐掉连接，1.5s 内一定 `process.exit`，避免口放了人还在。 |
| 口被占 | `EADDRINUSE` 直接退出，不当第二份活 BFF。 |
| 监督 | `scripts/dev.mjs` 两条启动路合成一套：活孩子在就不 spawn；口还开着不抢；口空才回收再拉一份。 |

one-bind overlay、现查、会话磁盘都没改。

## 本机怎么验的

1. 落地后只杀掉当时听运行口的那份旧 BFF，监督拉起新 `server.mjs`。新进程听运行口时清掉另一份旧 server。
2. `POST /api/v1/ai/connect` 后：`connected: true`，status 的 `pid` = 业务口 LISTEN 的 DSH，DSH 的 PPID = 运行口 LISTEN 的 BFF。当时只剩一套。
3. 再 `POST /api/v1/ai/reload`（带白名单 Origin），健康回来后再 connect：同样 `connected: true`，pid 对得上正在听的 DSH。
4. overlay 关键文件 SHA 与 `runtime/vendor-overlays/dsh-lan-assist` 仍一致（`probe.js` 仍是「没连业务，不能装成已查。」只走 `NO_CONNECTOR`）。`~/.dsh-fde-x/sessions` 还在。

单测：`node --test runtime/tests/reclaim-runtime.test.mjs` 4/4。

## 还没进内存的

当时的 `scripts/dev.mjs` 还是 18:48 那份进程。boot 守卫要等下次 `pnpm dev` 才进监督内存。旧监督仍可能 **短暂** 再 spawn 一份；新代码在口被占时退出，几秒内只剩听运行口的那套。不要把杀 `pnpm dev` 当成修好。

## 决策 22

没改 UI、没改 overlay、没改现查/改行/过账。会话仍在 DSH 家目录磁盘。重载会丢掉进行中的那一句，这是重载本身的代价，不是这次引入的。
