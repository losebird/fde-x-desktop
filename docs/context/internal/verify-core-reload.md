# verify-core-reload · scene-39「重载核心」

**时间**：2026-09-18  
**现网入口**：`http://127.0.0.1:5174`（Vite pid 48266）· BFF 默认 `http://127.0.0.1:4318`（`runtime/config.mjs` · `FDE_RUNTIME_PORT`）  
**失败截图（修前）**：`media/ace-core-reload-timeout.png`（「本地核心没有在 20 秒内回来」）

---

## 结论

| 项 | 内容 |
|---|---|
| **根因** | ① `POST /api/v1/ai/reload` 走 `scheduleRuntimeRestart()` 时原先 **`process.exit(0)` 未 `server.close()`**，多次重载后出现 **BFF 进程仍在、4318 无 LISTEN** 的僵尸态，探活永远失败。② 前端 `reloadAi()` **固定 20s**，且只 **`fetch(baseUrl/health)` 直连 4318**，BFF  down 期间即超时；**BFF 已 200 后只调一次 `connectAi`**，DSH 冷启动/刚被 SIGTERM 时会立刻 502，未重试。③ `pnpm dev` **「复用已有本地核心」** 分支不挂监督，reload 退出后 **无人再拉起 4318**（与 HANDOFF 描述一致）。 |
| **改了什么** | 提交 `0be0152`（scene-39 `main`，无 origin）：`runtime/server.mjs` reload 改 **`close()`**；`scripts/dev.mjs` **端口监督 + 僵尸进程 SIGKILL**、`复用` 时 **`watchRuntimePortAndSupervise`**；`src/lib/runtime-api.ts` **经 Vite 同源 `/health` 等待 BFF**，**90s 预算**（`FDE_RUNTIME_RELOAD_WAIT_MS` / `VITE_FDE_RUNTIME_RELOAD_WAIT_MS`），**轮询 `connect` + `ai/status` 直到 `connected`**；`CoreSettings` 文案用 **`bffOrigin`** 不再写死 4318；`vite.config.ts` 自起 runtime **带 `FDE_RUNTIME_SUPERVISED` 并在 exit 后再拉起**。 |
| **现在能不能回来** | **已对（脚本复验）**：在清掉僵尸 runtime、监督拉起新 BFF 后，`5174` 代理下 **reload → health → connect** 约 **6.5s**，`connected: true`（pid 25894）。**仍差**：Ace 若只跑裸 `vite`、未跑 `scripts/dev.mjs` 且占 4318 的是更老 orphan，需 **杀无 LISTEN 的 `runtime/server.mjs`** 或重启 `pnpm dev` 一次以加载 `0be0152`；**UI 点按截图** 本 agent 未产出（无 playwright 依赖）。 |

---

## 1. 现网：4318 / DSH / Vite 与 reload 实际行为（排查时快照）

| 组件 | 状态（排查时） | 说明 |
|---|---|---|
| **5174 Vite** | 在跑（pid 48266，cwd scene-39） | 未杀；`/health` 经 proxy 转发 BFF |
| **4318 BFF** | 曾 **无 LISTEN**（pid 4829 等僵尸） | `curl 127.0.0.1:4318/health` → connection refused；Vite `/health` → **500** |
| **4319 peer** | 77081 LISTEN | `dev-peer.mjs`，与主栈 4318 无关 |
| **DSH** | 随 BFF `POST /api/v1/ai/connect` 拉起 | 动态端口（例 `58236`），非产品写死 |
| **reload API** | `POST /api/v1/ai/reload` → 200 + `restarting: true` | BFF 内 **`scheduleRuntimeRestart()`**：监督模式下 **`close()`**（停 DSH + 关 HTTP + exit）；非监督再 **detach spawn**  successor |
| **探活（修前 UI）** | `reloadAi` → **`GET ${VITE_FDE_RUNTIME_URL}/health`**（通常 `http://127.0.0.1:4318/health`） | 不经过 5174 proxy；BFF 退出窗口 + 僵尸态 → **20s 内永远失败** |
| **20s 从哪来** | `src/lib/runtime-api.ts` **`Date.now() + 20_000`** | 与 `scripts/dev.mjs` 首次 **`waitFor(..., 12_000)`** 无关 |

---

## 2. 日志 / 行为链（修前典型）

1. 用户点「重载核心」→ `POST …/ai/reload` 200。  
2. 旧 BFF **`process.exit(0)`** 未优雅关 listen → 进程偶发 **挂死无端口**。  
3. `dev.mjs` 子进程 **未 exit** → **监督不触发** `boot()`。  
4. 前端 20s 内 **`4318/health` 全失败** → UI 文案「本地核心没有在 20 秒内回来」。  
5. 并行：DSH WebSocket **`ERR_CONNECTION_REFUSED`**（`.playwright-cli/console-2026-09-17…` 与现象一致）。

**修后**：reload 走 **`close()`**；监督 **2s 检测「进程在但端口不通」→ SIGKILL → 再拉起**；前端 **90s 内** 等同源 health + connect 重试。

---

## 3. 修后现网复验（等价 API，未杀 5174 Vite）

**前置**：`kill -KILL` 无 LISTEN 的 orphan `4829`/`25165` 后，监督进程拉起 **25797 LISTEN 4318**（仅 runtime，未动 Vite）。

```text
# 经 5174 模拟 reloadAi（health 同源 + connect 重试）
{"ok":true,"ms":6512,"pid":25894}
```

- `GET http://127.0.0.1:5174/health` → **200** `state: healthy`  
- `GET http://127.0.0.1:5174/api/v1/ai/status` → **`connected: true`**

**未做**：Playwright 设置页截图 → `media/core-reload-ok.png` **未生成**（环境无 `playwright` 包）。

---

## 4. 未改 / 锁

- **未动** `RecordsPanel` / `biz.mjs` 等未提交业务记录改动。  
- **未** `git add -A`；仅提交上述 6 个 core-reload 文件。  
- **未** 把探针脚本提交进产品（复验用一次性 node heredoc）。

---

## 5. Ace 侧建议（一次即可）

1. 在 scene-39 **`git pull`/同步 `0be0152`**（或本地已是该提交）。  
2. 若仍「复用已有本地核心」且 reload 失败：**结束无 LISTEN 的 `node runtime/server.mjs`**，保留 **`pnpm dev`**，让监督再拉起。  
3. 设置 → 模型与提供方 → **重载核心**；成功应见 **`{bffOrigin} 与 DSH 已重载`**（约数秒～数十秒，取决于 DSH 冷启动）。
