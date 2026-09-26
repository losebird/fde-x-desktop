---
cursor:
  subagentId: "bc-a9313865-7d49-501f-bd79-7442921c5d01"
---

# one-bind overlay 重载后实况（`5c8e2230`）

对照：`docs/small-model-biz-ops-land.md`、`docs/small-model-biz-ops-land-review.md`。只读核查，未改产品、未重载、未切分支。时间：2026-09-25 约 23:58（UTC+8）。

## 结论

**用上了。** 重载后磁盘上的 `dsh-lan-assist` 已是 one-bind overlay；运行中的 DSH 子进程 **PID 4360**（`~/.dsh-fde-x/run/dsh-core-fde-x.pid`）与重载时刻一致，经 profile 链到这份 vendor。

**但：** 对外 `GET /api/v1/ai/status` 仍报 **`connected: false`、`pid: null`**——不是 land 里那种 SIGKILL「核心挂死」，而是 **监听 4318 的 BFF（PID 4352）内存里没挂上 DSH 子进程**；DSH 实际由另一份更早的 `runtime/server.mjs`（PID **63579**）拉起。Ace 看灯：overlay 在、DSH 在听 **19527**，工作台 API 仍显示「未接通」。

---

## 1. 4318 / `GET /api/v1/ai/status`

| 项 | 值 |
|---|---|
| HTTP | **200** |
| `data.state` | `idle` |
| `data.connected` | **false** |
| `data.pid` | **null** |
| `data.lastError` | **null**（无 SIGKILL 文案） |
| `data.workspace` | `scene-39-personal-workstation` |
| `data.dshHome` | `~/.dsh-fde-x` |
| `data.lanPort` | `19527` |

**4318 通；** BFF 进程 **4352**，启动时间 **2026-09-25 23:55:38**（重载后新 PID）。

**DSH 核心子进程：** **4360**，同刻启动；pid 文件 `~/.dsh-fde-x/run/dsh-core-fde-x.pid` 内容为 `4360`。  
**19527** 由 **4360** `LISTEN`（lan-assist 口）。

**父子关系（关键）：** `4360` 的 PPID 是 **63579**（21:32 起的旧 `node runtime/server.mjs`），**不是** 4352。因此 4352 上的 `aiRuntime.status()` 无 `child` → API 里 `connected: false`。

---

## 2. overlay 三份是否同一内容（hash，非 mtime）

工作台 overlay：`runtime/vendor-overlays/dsh-lan-assist`  
家目录 vendor：`~/.dsh-fde-x/vendor/dsh-lan-assist`  
profile 链：`~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist` → **`~/.dsh-fde-x/vendor/dsh-lan-assist`**（符号链接）

以下文件 **SHA-256 与 overlay 完全一致**（`diff` 无差异）：

- `probe.js`、`lookup.js`、`relation-bind.js`、`write.js`、`slots.js`
- `enum-clues.js`、`vocab/spoken.js`、`vocab/spoken.json`

vendor 目录里另有历史整包拷贝留下的无关文件（`.git`、`client.js` 等），**one-bind 改动的 JS 已被 `applyVendorOverlay` 覆盖**；`probe.js` mtime **23:55:38**，与重载时刻对齐。

### 关键行为（vendor = overlay，已核对源码）

**`speakLookup`（`probe.js`）**

- `NO_CONNECTOR` → 「没连业务，不能装成已查。」
- 否则先读 **`found.hint`**（有则直接返回）
- `WHERE_UNBOUND` 仅在无 hint 时走兜底「筛选条件没对上词表列名…」，**不会**把 `WHERE_UNBOUND` 一律说成没连业务

**`enumHits` / `unboundWhereSpeak`（`relation-bind.js`）**

- `enumHits`：schema code/label + **该字段**词表 clue，唯一才绑
- `unboundWhereSpeak`：按型/字段/口语生成 hint，不是整句「没连业务」

**`lookup.js`**

- `WHERE_UNBOUND` 使用 `hint: unboundWhereSpeak(...)`；`bindClueEnums` 走 `enumHits`

**`write.js`**

- `WHERE_UNBOUND` 路径：`missSpeak` → **`speakLookup`**（带 hint）
- 「没连业务」仅 **`NO_CONNECTOR`** 分支（如 `missedSpeak` 里 `error === 'NO_CONNECTOR'`）

---

## 3. 运行中实际 require 链

| 角色 | PID | 加载 `dsh-lan-assist` 的方式 |
|---|---|---|
| BFF | 4352 | 不直接 require；通过 `dsh-core.mjs` 管子进程与 RPC |
| DSH 子进程 | 4360 | `DSH_HOME=~/.dsh-fde-x`，profile **fde-x**；bundle 含 `dsh-lan-assist`，解析自 **`profiles/fde-x/node_modules/dsh-lan-assist`** → **`~/.dsh-fde-x/vendor/dsh-lan-assist`** |

`dsh-core.mjs` 在 `startInternal` 里调用 `ensureIsolatedProfile()` → `linkReadablePlugin('dsh-lan-assist')` → **`applyVendorOverlay` 把工作台 overlay 拷入 `~/.dsh-fde-x/vendor/dsh-lan-assist`** 再链到 profile。重载时该路径已执行（vendor 关键文件 mtime 23:55:38）。

**若只盯「仓库 overlay 没覆盖到运行副本」：** 当前 **没有** 这种差分——vendor 与 `runtime/vendor-overlays/dsh-lan-assist` 的 one-bind 文件一致。

**若盯「工作台认为核心已连接」：** 差在 **BFF 4352 未持有 DSH 4360 的 connector 状态**（双 `server.mjs`：63579 spawn、4352 对外监听），不是 overlay 未刷。

---

## 4. 与 land / review 的对照

- land 写「现网 SIGKILL、4318 connected false」：**本次无 `lastError` SIGKILL**；DSH **4360 在跑**。
- review 写 overlay 经 `applyVendorOverlay` 进 vendor、IM 读 profile：**链路成立，hash 已验**。
- **主验收句现网一遍过**：仍取决于 BFF **connected** 与 Qwen 会话；当前 status **仍 disconnected**，Ace 不能当「已接通可打验收」。

---

## 证据命令（本机已跑）

- `curl -sS http://127.0.0.1:4318/api/v1/ai/status`
- `lsof -i :4318` / `lsof -i :19527`
- `ps -p 4352,4360,63579 -o pid,ppid,lstart,command`
- `cat ~/.dsh-fde-x/run/dsh-core-fde-x.pid`
- `shasum -a 256` 对比 overlay 与 vendor 关键文件
- `readlink ~/.dsh-fde-x/profiles/fde-x/node_modules/dsh-lan-assist`
