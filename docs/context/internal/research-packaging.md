# FDE-X 单包分发调研（只读）

源码根：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`
实测环境：macOS，`du`/`node --version` 于 2026-09-17。

## A. 运行时依赖

### 1. FDE-X 自身
- **Node**：根 `package.json` 无 `engines`、无 `.nvmrc`；`devDependencies` 用 `@types/node@22`（L30–31）。**运行时硬需求 Node ≥22**：`runtime/db.mjs` L1 `node:sqlite`；`runtime/server.mjs` L9–13 `node:zlib` 的 `zstdCompress/Decompress`（会话 `.jsonl.zstd` 修补 L737–831）。
- **pnpm**：存在 `pnpm-lock.yaml`（lockfileVersion 9），脚本未声明 `packageManager`；开发用 pnpm，**生产 BFF 不依赖 pnpm**（直接 `node runtime/server.mjs`）。
- **npm 生产依赖**（根 `package.json` L15–26）：纯 JS（React/Vite 构建前端）；**无 better-sqlite3**。原生仅 **dev 可选** `fsevents`（Vite/chokidar，不打进 BFF）。
- **`runtime/*.mjs` 外部命令**：`dsh-core.mjs` L16 `pgrep`、L27 `lsof`；`server.mjs` L34 `osascript`（目录选择，mac 专用）；`spawn`：`dsh-core.mjs` L241（Node 拉起 dsh）、`server.mjs` L22（非监督重启）、`smoke.mjs` L10。

### 2. DSH
- **形态**：全局 npm `@deepseek-ai/dsh@0.1.5-rc.1`（`/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/package.json` L1–16 `bin.dsh`→`lib/bin.js`）；CLI `dsh web` = `--profile` + `--patch` + loopback。
- **体积**：本机 `du -sh` ≈ **279M**（含大量 `@deepseek-ai/*` 与传递依赖）。
- **原生/二进制**：`sharp`+`@img/sharp-*`（L29 预编译 `.node`）；`koffi`（FFI）；`@vscode/ripgrep`（平台 ripgrep）；无 Python 在 DSH 主包内。可选 `@deepseek-ai/dsh-experimental-code-runtime-python`（依赖声明 L125，语义 Python 走插件 runtime）。
- **FDE 定位 dsh**：`resolveDshBin` `runtime/dsh-core.mjs` L49–61 — 顺序 `FDE_DSH_BIN` → **`/opt/homebrew/bin/dsh`** → `/usr/local/bin/dsh` → `PATH`；`scripts/dev.mjs` L8–11 同；`runtime/start.sh` L3 默认 homebrew。
- **Profile**：`ensureIsolatedProfile` L354–381 — `DSH_HOME/profiles/fde-x/package.json` 的 `dsh.profile.bundles` 含 `dsh-base`、`dsh-web-app`、可选 `dsh-lan-assist`/`dsh-semantic-os`；`cordis.yml`/`cordis.patch.yml` 空数组；`fde-x-dsh-bridge` **symlink** 到 `runtime/fde-x-dsh-bridge`。
- **`--patch`**：启动 L241–245 `dsh --profile fde-x --patch <file> --host 127.0.0.1 --port 0`；默认 patch `runtime/dsh-core.patch.yml`（L143、`server.mjs` L78）— Cordis 覆盖 credentials/session/storage 路径、禁用官方设置 UI、插入 `fde-x-dsh-bridge`（L3–36）。

### 3. semantic-os
- **1.8GB 树**（`~/.dsh-fde-x/semantic-os/runtime`，`du` 1.8G；`current.json`：`0.1.1`/`darwin-arm64`）：几乎全在 **`python/` 嵌入式 CPython 3.12.10**（`runtime-manifest.json` L5–8；`du` python 子目录 1.8G）。
- **Python 栈**（`resolved-requirements.txt`）：`semantica`、`faiss-cpu==1.15.0`、`onnxruntime==1.29.0`、`sklearn`、`FalkorDB`+**`falkordblite`**（嵌入式图，**非** Redis 模块/Docker 必需）、`redis`/`redislite`、`torch==2.13.0`（本机 torch 包 ≈501M）。工作区图数据在运行时 cache/工作目录，非固定 `graph.json` 进包。
- **平台二进制**：整棵 `runtime/<ver>/<platform-arch>/` 按 manifest 发布；vendor 备选 `DSH_HOME/vendor/dsh-semantic-os/runtime-dist/<platform-arch>`（`findSemanticRuntimeSource` L444–467），本机 `runtime-dist/darwin-arm64` **1.8G**。
- **拷贝逻辑 L384–410**：目标 `DSH_HOME/semantic-os/runtime`（禁 symlink，`ownedSemanticRuntime` L430–441）；源优先 `~/.dsh/semantic-os/runtime`+`current.json`，否则 `vendor/.../runtime-dist/<platform>-<arch>`；staging 全量 `cp`；`install-state.json` 可从 `~/.dsh/semantic-os/install-state.json` 改写 `python` 路径 L412–425。
- **Sidecar**：`dsh-semantic-os/sidecar.js` L114–172 — `installer.ensure()` 后 **`spawn(python, bootstrap.py)`**；Python 来自 **`DSH_SEMANTICA_PYTHON`**（FDE 在 `dsh-core.mjs` L258 注入）或 installer 探测；`DSH_SEMANTICA_PORT: '0'` 动态端口 L152；cache 在 `DSH_HOME/semantic-os/cache`（HF/torch 等可再增长）。

### 4. lan-assist
- **Vendor**：`~/.dsh/vendor/dsh-lan-assist/`（FDE `dev.mjs` L26–28 可 symlink 官方 vendor）；插件 **MIT**（`package.json` L95）。
- **依赖**：Node ≥20（L122–124）；`optionalDependencies.nats`；`sqlite.js` 可选 **`node:sqlite`**（非 better-sqlite3）；bundled `vendor/office`（xlsx/mammoth/jszip）。
- **加载**：profile `bundles` 含 `dsh-lan-assist`（`dsh-core.mjs` L359–367）；插件 `dsh.bundle.patch`→`cordis.patch.yml`（`package.json` L103–107）。监听 **`DSH_LAN_ASSIST_PORT`**，默认插件 **9527**（`home.js` L10），FDE dev 设 **19527/18528**（`dev.mjs` L106，`dev-peer.mjs` L12）。

### 5. 硬编码路径/端口（仓内 + 关键脚本，不含 node_modules）
| 项 | 位置 |
|----|------|
| `/opt/homebrew/bin/dsh` | `dsh-core.mjs` L54；`dev.mjs` L10；`start.sh` L3 |
| `/usr/local/bin/dsh` | 同上 L55/10 |
| `~/.dsh-fde-x` / `~/.dsh-fde-peer` | `dsh-core.mjs` L140；`dev.mjs` L19；`dev-peer.mjs` L13–15 |
| `~/.dsh` 官方家 | `dsh-core.mjs` L417/445；`server.mjs` L935/965；`dev.mjs` L18–27 |
| `runtime/dsh-core.patch.yml` | `dsh-core.mjs` L143；`server.mjs` L78 |
| 端口默认 **4318/4319** BFF | `server.mjs` L73；`dev.mjs` L16；`dev-peer.mjs` L10 |
| **5174/5175** Vite dev | `dev.mjs` L17；`AI.tsx` L29 |
| **5173/4173** vite 配置 | `vite.config.ts` L103/108；`server.mjs` L198 Origin 白名单 |
| **19527/18528** LAN | `dev.mjs` L106；`dev-peer.mjs` L12；`dsh-core.mjs` L188/255 |
| DSH **`--port 0`** | `dsh-core.mjs` L247 |
| 示例 `/Users/…` 文案 | `server.mjs` L1383 |

### 6. 许可证（随包需附 NOTICE）
- **DSH / @deepseek-ai/\***：`MIT`（dsh `package.json` L29）。
- **dsh-lan-assist / dsh-semantic-os**：`MIT`（各自 `package.json`）。
- **semantic runtime**：`runtime/.../LICENSES/`（含 `python-distributions.json` 226KB，列 **faiss-cpu、FalkorDB、falkordblite** 等 wheel 元数据）；faiss 附带 **MIT + THIRD_PARTY_NOTICES**（site-packages 内）。**torch/transformers/onnx** 等需在 `LICENSES` 或 SPDX 清单中一并列出方可合规分发；FalkorDB 家族建议法务复核（客户端库 + lite 二进制）。

## B. 平台约束

### 7. Windows
- **不可用命令**：`pgrep`/`lsof`（进程回收 L14–31）；`osascript`（可跳过）。
- **PATH 解析**：`PATH.split(':')` L50 — 需 `path.delimiter`。
- **Symlink**：profile 插件 link L350 — 需开发者模式或改为 junction/copy。
- **zstd**：依赖 **Node 22+ 内置**；旧 Node 无 zlib zstd。
- **语义栈**：需 **win32-x64/arm64 专用 runtime-dist**（faiss/onnx/torch wheel）；FalkorDBLite 为平台原生库。
- **中文/非 ASCII cwd**：`semanticCwd` L115–118 语义路径要求 ASCII；`server.mjs` 多处 `/` 绝对路径假设。
- **监督重启**：`server.mjs` L16–29 `process.exit(0)` + `dev.mjs` L78–90 轮询 — Windows 信号行为需验证。

### 8. Linux
- 同上 pgrep/lsof；**torch** 在 `constraints.txt` L4 强制 **`torch==2.13.0+cpu`**（避免 CUDA 400MB+）。
- 发行版：glibc/musl 与 **Python runtime 构建目标**必须一致；无 homebrew 路径。
- macOS **TCC/文稿** 提示（`Files.tsx` L408）不适用于 Linux。

### 9. 网络/端口
| 组件 | 默认 | 可动态？ |
|------|------|----------|
| FDE BFF | 4318/4319（env） | 是 |
| Vite UI dev | 5174/5175 | 是 |
| DSH web | **0**（OS 分配） | 是 |
| semantic sidecar | **0**（`DSH_SEMANTICA_PORT`） | 是 |
| lan-assist | 9527 / FDE 19527 | env `DSH_LAN_ASSIST_PORT` |
| 生产形态 | 应用应 **静态资源进 BFF 或壳**，单端口或固定 loopback | 需产品决策 |

## C. 打包架构候选

| 候选 | 体积（单平台粗算） | 工作量 | 优 | 劣 / 风险 |
|------|-------------------|--------|-----|-----------|
| **1 Electron + 内置 Node22 + npm 树 DSH + vendor 插件 + 嵌入式 Python runtime** | UI壳 ~150M + DSH ~280M + 插件 ~50M（不含 git）+ **semantic 1.8G** ≈ **2.2–2.5G/架构** | **L–XL** | 与现有 spawn/Node 模型一致；易控 loopback | 安装包巨大；三平台 × 多架构要 CI；代码签名 |
| **2 Tauri + sidecar（Node SEA/pkg 打 BFF+DSH + Python 同候选1）** | 壳 ~15M + sidecar 类似 | **XL** | 安装包 UI 小 | Rust 编排、Windows WebView2、sidecar 调试成本高 |
| **3 轻壳 + 首次下载 runtime** | 安装包 ~300M；首次 +1.8G | **M–L** | 迭代 semantic 版本快 | 需 CDN/校验/离线失败；企业禁出网 |

**semantic 1.8G 瘦身**：torch ~50% 树；可选延迟下载 **HF 模型**（已在 `semantic-os/cache`）；**不能**用 Pyodide 替代 faiss/torch/FalkorDBLite；uv 仅加速安装，不减小运行时。**可选裁剪**：无 IM 时不 bundle lan-assist；无语义 Tab 时不拷 runtime（功能降级）。

**推荐**：**候选 1 变体** — Electron（或等价固定 Node 运行时）+ **按平台/架构分包**（非"一个二进制通吃三 OS"）+ 资源目录内置 `dsh` npm、`vendor` 插件、`runtime-dist`；用户数据仍 `$FDE_DSH_HOME`。**理由**：现架构已是多进程 Node+Python，改动最小；Tauri 收益不足以抵消 sidecar 风险；纯在线下载难满足"只装一个包"。

**第一步**：（1）引入 **`FDE_APP_ROOT`/`FDE_RESOURCES`**，去掉 homebrew 默认，bundled `FDE_DSH_BIN`+插件源；（2）**跨平台进程/端口工具** 替换 pgrep/lsof；（3）做 **macOS arm64 可安装包 POC**（内置 Node22、`pnpm build` 静态 UI 由 BFF 或 file:// 服务、semantic 从 `runtime-dist` 拷到用户目录）；（4）并行法务整理 `LICENSES/python-distributions.json`。
