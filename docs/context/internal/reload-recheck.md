---
cursor:
  subagentId: "bc-cc8e77e8-c6db-5b02-8ea1-79fac230881e"
---

# Ace 再点「重载核心」后现网复核

只读。未改产品、未重载、未切分支。对照 `docs/core-reload-dual-bff.md`、`internal/overlay-reload-check.md`。时间：**2026-09-26 00:31（UTC+8）**。

## 结论

**没问题。** 四条验收都过：灯亮、单套 BFF+DSH 父子对、overlay SHA 一致、未见 SIGKILL / 口在人死类回归。

（和昨晚 overlay 报告里的 **双 BFF** 不同：当时 `connected: false`；这次重载后 **已对齐**。）

---

## 1. `GET /api/v1/ai/status`（4318）

| 项 | 现网 |
|---|---|
| HTTP | **200** |
| `connected` | **true** |
| `pid` | **13573** |
| `lastError` | **null** |
| `state` | `connected` |
| `lanPort` | `19527` |

`recentLogs` 里有「清掉残留核心 13545」——回收旧 DSH 后拉起新核，不是报错。

---

## 2. 一套 BFF + 一套 DSH（运行口父子）

| 角色 | PID | 口 | 说明 |
|---|---|---|---|
| BFF `runtime/server.mjs` | **13486** | **4318** LISTEN | PPID **1115**（`scripts/dev.mjs`），启动 **00:29:02** |
| DSH 核心（fde-x） | **13573** | **19527** + DSH web **59248** | **PPID = 13486**，启动 **00:29:06** |
| pid 文件 | — | `~/.dsh-fde-x/run/dsh-core-fde-x.pid` → **13573** | 与 status.pid 一致 |

**听 4318 的 BFF 就是 spawn DSH 的父进程。** 核查时刻只剩 **一份** `runtime/server.mjs`（13486）。

说明：本机另有 **47968** `dsh web`（3080/9527），是别的 `dsh web` 实例，**不是**本工作台 profile 链上的第二套 BFF+核；不计入「双 BFF」问题。

（复核开头 `pgrep` 曾短暂看到第二个 `server.mjs` PID，数秒内已消失，符合「口被占则退出、不挂第二份活 BFF」；当时 **4318 始终只有 13486**。）

---

## 3. overlay 关键文件 SHA

工作台 `runtime/vendor-overlays/dsh-lan-assist` ↔ `~/.dsh-fde-x/vendor/dsh-lan-assist`（profile `node_modules/dsh-lan-assist` → vendor 符号链接）：

- **一致**：`probe.js`、`lookup.js`、`relation-bind.js`、`write.js`、`enum-clues.js`、`vocab/spoken.js`
- `probe.js` vendor mtime：**2026-09-26 00:29:05**（与本次重载同刻）

行为仍是对照版：`speakLookup` 仅 **`NO_CONNECTOR`** →「没连业务，不能装成已查。」；`enumHits` / `unboundWhereSpeak` 在 `relation-bind.js`，`lookup.js` / `write.js` 走 hint 链。

---

## 4. 回归项（EADDRINUSE / SIGKILL / 灯灭）

| 检查 | 结果 |
|---|---|
| status `lastError` | **无** SIGKILL 文案 |
| DSH **13573** | 在听 **19527**，进程存活 |
| 4318 | 有进程、status **connected: true**（非「口通灯灭」） |
| 本次未扫全量日志 | status / recentLogs **无** EADDRINUSE 暴露给 Ace |

---

## 证据（本机已跑）

```text
curl -sS http://127.0.0.1:4318/api/v1/ai/status
lsof -iTCP:4318 -sTCP:LISTEN -P -n
lsof -iTCP:19527 -sTCP:LISTEN -P -n
ps -p 13486,13573 -o pid,ppid,lstart,command
pgrep -fl 'runtime/server.mjs'
cat ~/.dsh-fde-x/run/dsh-core-fde-x.pid
shasum -a 256（overlay vs vendor 六文件）
```
