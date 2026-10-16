# 重载核心无效 · 根因（scene-39 · Ace Mac）

**排查时间**：2026-09-25 17:59 CST  
**入口**：`http://127.0.0.1:5174`（`dev.mjs` + Vite pid **42443**）  
**对照**：`internal/verify-core-reload.md`（9/18 修过 reload/监督/90s 等待；**本次是现网再次挂死后的链路与监督缺口**）

---

## 结论（先读这段）

| 问题 | 根因 |
|------|------|
| 设置里 **「核心未接通 · Failed to fetch」** | **4318 上没有 HTTP 服务**（`lsof` 无 `LISTEN`，`curl 127.0.0.1:4318` → `ECONNREFUSED`）。UI 的 `runtimeApi.aiStatus()` / 多数 BFF 请求走 **`VITE_FDE_RUNTIME_URL` 直连 `http://127.0.0.1:4318`**，浏览器报 **Failed to fetch**。经 5174 代理的 `/api/v1/*` 同样 **HTTP 500**（Vite 反代连不上后端）。 |
| 点 **「重载核心」** 仍起不来 | **不是没发请求的逻辑 bug，而是发不出去 + 拉不起来**：① BFF 已死时 `POST /api/v1/ai/reload` 也是 **直连 4318**，同样 **连不上**（`reloadAi` 虽 `catch` 后继续等 `/health`，但代理后端仍死 → 等到超时）。② 更关键：**`pnpm dev` 走「复用已有本地核心」时**，`scripts/dev.mjs` 的 `watchRuntimePortAndSupervise` **只在 `child === null` 且端口不通时才 `boot()`**；现网 **子进程还在（pid 14216）但 4318 已无 LISTEN** → **监督死锁，永远不会再 spawn**。`runRuntime` 分支有「进程在但端口不通 → SIGKILL」，**复用分支没有**。③ 另有 **第二条孤儿** `runtime/server.mjs`（pid **20250**，ttys037 手启），加剧端口争用历史（日志里多次 **EADDRINUSE**）。 |
| **d7c3d3ab** 会不会把启动炸掉？ | **否（就这次挂死而言）**。该提交只改 `runtime/adapters.mjs`、`runtime/biz/connection-lamp.mjs` 与测试，**不动** `server.mjs` listen/reload/`close()`。现网是 **BFF 僵尸/无监听**，不是新代码在 boot 时抛错。 |
| Vite 代理是不是根因？ | **不是**。5174 **在监听**；失败原因是 **upstream 4318 不存在**，不是 proxy 配错。 |

**一句话**：重载路径设计上依赖「reload → BFF `close()` 退出 → 监督再拉起」；Ace 机上 BFF 已进入 **进程活着、端口没了** 的状态，且 **复用监督不会杀僵尸也不会在 `child` 非空时重启**，所以 **重载既打不中 API，也等不到新核心**。

---

## 现网快照（证据）

```text
# 端口
lsof -iTCP:4318 -sTCP:LISTEN   → 无
lsof -iTCP:5174 -sTCP:LISTEN   → node 42443 (vite)

# 探活
curl http://127.0.0.1:4318/health              → ECONNREFUSED
curl http://127.0.0.1:5174/health              → HTTP 500
curl -X POST http://127.0.0.1:5174/api/v1/ai/reload → HTTP 500

# 僵尸 BFF（均无 LISTEN，运行 1～2 天）
pid 14216  PPID 42442  node runtime/server.mjs   # dev.mjs 子进程
pid 20250  PPID 20200  node runtime/server.mjs   # 另一终端手启

portOpen(4318) 探测 → false
netstat：大量 127.0.0.1:4318 FIN_WAIT_1 / ESTABLISHED（Vite 长连打到已死的 BFF）
```

---

## 代码链（与日志对齐，不猜）

### 1. UI「Failed to fetch」

- `src/pages/AI.tsx`：`核心未接通。${runtimeError}`，`runtimeError` 来自 `runtimeApi` 的 `RuntimeApiError` / 原生 **`Failed to fetch`**。
- `src/lib/runtime-api.ts` **`request()`**：`fetch(\`${this.baseUrl}${path}\`)`，浏览器下 **`baseUrl` = `http://127.0.0.1:4318`**（`VITE_FDE_RUNTIME_URL`），**不经 5174 代理**。
- BFF down → `aiStatus`、`connectAi`、以及 **`reload` 的 POST** 全部直连失败。

### 2. `reloadAi()` 实际行为

```667:709:src/lib/runtime-api.ts
  async reloadAi(signal?: AbortSignal): Promise<AiRuntimeStatus> {
    // POST /api/v1/ai/reload → this.request() → 直连 4318
    try {
      await this.request(...'/api/v1/ai/reload'...)
    } catch {
      /* 4318 正在退出，连不上也算已经开始重载 */
    }
    // 之后用 uiFetchUrl('/health') → 同源 5174 代理，等 BFF 回来
    // 再轮询 connectAi / aiStatus（connect 仍直连 4318）
```

- **BFF 已僵尸**：POST **根本没打到** reload 处理器；`catch` 后 **health 永远 500** → 用户看到重载失败或长时间「正在重载」后超时（90s 预算）。
- **BFF 仍活着时** reload：`runtime/server.mjs` `POST /api/v1/ai/reload` → `scheduleRuntimeRestart()` → `close()`（`server.close` + `process.exit`）。见 `runtime/server.mjs` 1147–1167、2736–2743。

### 3. 为什么「杀掉旧进程」后新核心没起来（监督死锁）

`scripts/dev.mjs` 在 **4318 已被占用** 时走 **复用** 分支（Ace 的 `pnpm dev` 已跑 2 天+）：

```153:157:scripts/dev.mjs
  const watch = async () => {
    while (!shuttingDown) {
      if (!child && !(await portOpen(port, 300))) boot()
      ...
```

- 条件要求 **`!child`**。pid **14216** 仍是 dev 的子进程且 **未 exit** → `child` 非空。
- 同时 **`portOpen(4318) === false`**（无 LISTEN）。
- 循环 **既不 `boot()` 也不杀进程**。

对比 **`runRuntime`** 分支（首次起核心时）有 2s 轮询：**进程在但端口不通 → SIGKILL → 再 boot**（`dev.mjs` 107–112）。**复用分支缺这段** → 与 9/18 `verify-core-reload` 里「僵尸无 LISTEN」同类，但 **监督条件更苛刻**。

### 4. 双 runtime 与 EADDRINUSE（历史日志）

本机 Cursor 终端留痕（例 `terminals/182985.txt`、`182990.txt`）：

```text
FDE_LISTENING 4318
FDE-X runtime listening on http://127.0.0.1:4318
Error: listen EADDRINUSE: address already in use 127.0.0.1:4318
```

说明曾 **多份 `runtime/server.mjs` 同时争 4318**（含评估脚本 `pkill` / 手启）。与 **20250** 并存时，监督拉起的新进程也可能 **bind 失败**，加重「回不来」。

---

## 排除项

| 假设 | 结论 |
|------|------|
| 请求没发 | UI 会发；**BFF 不可达** 时 POST 在浏览器层失败 |
| Vite 代理坏了 | 5174 正常；**500 = 后端 refused** |
| UI 找不到新进程 | 不是 PID 展示问题；是 **根本没有新 LISTEN** |
| d7c3d3ab 启动崩溃 | **无证据**；挂死形态是 **无端口僵尸 + 监督死锁** |

---

## 证据文件索引

| 位置 | 内容 |
|------|------|
| 本文件 | 2026-09-25 现网根因 |
| `internal/verify-core-reload.md` | 9/18 reload/`close()`/90s/监督首轮修复与 API 复验 |
| 仓库 `scripts/dev.mjs` | `watchRuntimePortAndSupervise` vs `runRuntime` 差异 |
| 仓库 `src/lib/runtime-api.ts` | 直连 4318 vs `uiFetchUrl` 仅 health 等 |
| Ace 终端 `182990`–`182995` | EADDRINUSE / ECONNREFUSED / pkill runtime |

---

## Ace 侧（运维，非本次改产品）

若要 **验证** 监督能否恢复：需清掉 **无 LISTEN 的 `runtime/server.mjs`**（含 14216、20250），保留 `pnpm dev`，让 **端口空 → `boot()`** 或走 `runRuntime` 的 SIGKILL 逻辑。本次任务 **未执行杀进程**（按 Ace 要求只查根因）。
