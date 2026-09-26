---
cursor:
  subagentId: "bc-7fe8dd9c-0d6c-52f7-8db1-abd1ddbcd501"
---

# leftover overlay 现挂核对（Ace 本机）

对照：[leftover-cancel-fix.md](./leftover-cancel-fix.md)（`bc-197ecf79` / `20c234fb`）。只读核对，未 reload、未动 5174/4318。

## 结论

**`20c234fb` 已在仓库 HEAD 与 `runtime/vendor-overlays/dsh-lan-assist` 源里；尚未挂到 DSH 实际加载的 `~/.dsh-fde-x/vendor/dsh-lan-assist`，当前在跑的 lan-assist 也不是这份代码。**  
仅 connect / 重连工作台 **不会** 生效；需要先 **把 overlay 拷进 vendor**（或带 `FDE_REFRESH_PLUGINS=1` 让 `linkReadablePlugin` 重建 vendor 后再 `applyVendorOverlay`），再 **重启 DSH 子进程**（现 PID 95908，父进程 `runtime/server.mjs` 90180）。4318 已在听，本次未要求 reload runtime；若也要 BFF `cancel` 转发 `kind` 与右栏 `records-cancel`，还需 **重启 90180**（其启动早于 commit）。

---

## 1. Git HEAD

| 检查 | 结果 |
|------|------|
| `git log -1 --oneline`（repo: `scene-39-personal-workstation`） | `20c234fb fix(lan-assist): stop leftover cancel from killing post-write live lookup` |
| commit 时间 | `2026-09-24 16:17:09 +0800` |

---

## 2. Overlay 源文件（仓库内现查标记）

路径：`runtime/vendor-overlays/dsh-lan-assist/`

| 标记 | 结果 |
|------|------|
| `roundClose: 'wrote'` | `gate.js` L513 |
| `plugin-leftover` | `session-round.js`、`tools.js`、`index.js` |
| `recoverWriteIntent` | `slots.js` L1763；含 **现查 + `no` 槽** 早退（L1773–1778） |

---

## 3. 正在跑的 lan-assist（DSH 加载份，非 git 工作区 alone）

### 进程与路径

| 项 | 值 |
|----|-----|
| DSH | PID **95908**，`dsh --profile fde-x --patch …/runtime/dsh-core.patch.yml`，启动 **2026-09-23 23:53:41**（早于 `20c234fb`） |
| 父进程 | **90180** `node runtime/server.mjs`（4318 LISTEN），启动 **2026-09-23 23:09:09** |
| `FDE_DSH_HOME` 默认 | `~/.dsh-fde-x` |
| 插件目录 | `~/.dsh-fde-x/vendor/dsh-lan-assist` |
| profile 解析 | `~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist` → **symlink 到 vendor**（与 vendor 同 inode） |

### 与 overlay 是否一致

对 fix 涉及的 5 个文件 `diff -q`：**全部 differ**（`session-round.js`、`slots.js`、`gate.js`、`index.js`、`tools.js`）。

| 证据 | overlay（20c234fb） | live vendor |
|------|---------------------|-------------|
| `plugin-leftover` / `roundClose` | 有 | **无**（grep vendor 树为 0 命中） |
| `session-round.js` SHA256 | `09383cce…` | `d0775f57…` |
| `gate.js` SHA256 | `182f488d…` | `4351d267…` |
| vendor `session-round.js` mtime | — | `2026-09-24 00:40:15`（早于 commit 16:17） |
| overlay `session-round.js` mtime | `2026-09-24 16:15:43` | — |

**行为差异示例（live vendor `session-round.js`）：** 同轮 leftover 仍走 `closeRound(sid, 'leftover')` 且 **无** `cancelKind: 'plugin-leftover'`、无 overlay 里「无 preview_id 的现查覆盖 speech 误绑」分支。

**`recoverWriteIntent`：** vendor 仍有函数名，但 **缺少** overlay 中 `toolAction === '现查' && toolNo` 的早退块（overlay L1773–1778；vendor 从 L1772 直接 `if (!speech || !kind)`）。

### overlay 何时写入 vendor

`runtime/dsh-core.mjs`：`applyVendorOverlay` 仅在 `linkReadablePlugin` 路径执行；vendor 已存在时 **不会** 因仓库 overlay 更新而自动再拷（除非 `FDE_REFRESH_PLUGINS=1` 删 vendor 后重建）。

### 4318 / connect / restart（按指派未操作）

| 动作 | 能否让 lan-assist 变为 `20c234fb` |
|------|-----------------------------------|
| 仅 connect / 重连 UI | **否** |
| 只重启 4318 `server.mjs` 且不先同步 vendor | **否**（仍会 `applyVendorOverlay` 到旧 vendor 或跳过） |
| **同步 overlay → vendor + 重启 DSH（95908）** | **是**（Node 已 require 旧模块） |
| 右栏 + BFF `kind` 整条链 | 另需 **重启 90180**（进程内 `server.mjs` 亦早于 commit；磁盘 `server.mjs` mtime `2026-09-24 16:16:22`） |

5174 Vite 未测 HMR；左栏逻辑在 DSH 插件内，与 5174 刷新无关。

---

## 4. 单号 / kind / action 写死

| 模式 | 命中 |
|------|------|
| `388419542908928` | **仅** `runtime/tests/slots-enrich.test.mjs` |
| `plugin-leftover` | overlay + 测试；**不在** `src/` |
| `records-cancel` | `src/components/biz/RecordsPanel.tsx`（右栏 cancel kind 常量，非单号） |

未发现把 `388419542908928` 写进产品 overlay / `src` 业务逻辑。

---

## 5. 与 [leftover-cancel-fix.md](./leftover-cancel-fix.md) 对齐

| fix 文档声称 | 本机 live |
|--------------|-----------|
| overlay 已改 | ✅ 仓库一致 |
| DSH 跑 overlay 结果 | ❌ vendor 与进程均未挂上 `20c234fb` |
