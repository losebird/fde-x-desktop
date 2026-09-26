---
cursor:
  subagentId: "bc-a1a93225-9dd2-5a97-b230-65ce4221a05b"
---

# leftover overlay 已挂到 Ace 本机 DSH

对照 commit **`20c234fb`**（[leftover-cancel-fix.md](./leftover-cancel-fix.md)）。只部署，未改仓库产品逻辑、未 `POST /api/v1/ai/reload`、未推远程、未重启 Vite。

## 1. 同步

**源：** `scene-39-personal-workstation/runtime/vendor-overlays/dsh-lan-assist/`（19 个文件）  
**目标：** `~/.dsh-fde-x/vendor/dsh-lan-assist/`（`cp -R overlay/. vendor/`）

挂 fix 前 **5 个文件与 overlay 不一致**（`diff -q`）：`session-round.js`、`slots.js`、`gate.js`、`index.js`、`tools.js`。

同步后 **overlay 树内 19 个文件与 vendor 逐字节一致**（`cmp`）。vendor 内仍保留上游插件拷贝带来的额外目录/文件（`.git`、`node_modules` 等），未删除。

| 文件 | 同步后 SHA256（与 overlay 相同） |
|------|----------------------------------|
| `session-round.js` | `09383cce…` |
| `gate.js` | `182f488d…` |

`~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist/session-round.js` 与 vendor **同 inode**（67101433）。

## 2. 重启

| 组件 | 动作 | 结果 |
|------|------|------|
| DSH | `POST /api/v1/ai/disconnect` → `POST /api/v1/ai/connect`（`Origin: http://localhost:5174`） | 旧 PID **95908** 已退出；新 DSH PID **274**，启动 `2026-09-24 16:23:42 +0800` |
| BFF `runtime/server.mjs` | **未重启** | PID **90180** 不变，仍 **唯一** `localhost:4318` LISTEN |
| Vite | **未动** | PID **42443**，`5174` LISTEN 不变 |

未调用 `POST /api/v1/ai/reload`。BFF 内 `cancel` 转发 `kind` / 右栏 `records-cancel` 仍依赖进程内旧 `server.mjs`；本次指派只挂 **lan-assist overlay**，故未重启 90180。

## 3. Live vendor 核对（与 overlay 源一致）

| 标记 | 位置 | 结果 |
|------|------|------|
| `roundClose: 'wrote'` | `gate.js` L513 | ✅ |
| `plugin-leftover` | `session-round.js`（3）、`tools.js`（1）、`index.js`（2） | ✅ |
| `recoverWriteIntent` 现查 + `no` 早退 | `slots.js` L1773–1778：`toolAction === '现查' && toolNo` → `return next` | ✅ |

## 4. Git

`git log -1 --oneline`：`20c234fb fix(lan-assist): stop leftover cancel from killing post-write live lookup`

---

**Internal refs:** [leftover-overlay-live.md](./leftover-overlay-live.md)（挂前状态）、[leftover-cancel-fix.md](./leftover-cancel-fix.md)（变更说明）
