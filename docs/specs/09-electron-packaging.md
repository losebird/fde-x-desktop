# 09 · Electron 单包分发（mac → Windows → Linux）

依赖：`runtime/config.mjs`（已落地）；功能规格 01–08 完成后再出正式包，但 P1 POC 可先行。协议：`00-agent-protocol.md`。背景：`../packaging-design.md`。

## 1. 目标

用户只安装一个包：Electron 壳 + 内置 Node 22 + BFF + DSH npm 树 + lan-assist + fde-x-dsh-bridge + semantic-os runtime；首次启动自动初始化用户目录；按平台分包；mac 签名公证、Windows Authenticode；自动更新按组件。

## 2. 范围与禁区

- 做：`apps/desktop/`（Electron 主进程）、`scripts/pack/`（资源组装）、GitHub Actions matrix、首启初始化、进程生命周期、静态前端由 BFF 服务、组件化更新、可选组件（语义引擎）。
- 不做：Tauri；一个二进制多平台；在线首启下载（企业禁网）；改 DSH/semantic-os 源码。
- 禁区：开发态 `pnpm dev` / `dev:peer` 行为不变；不把 Electron 依赖加进根 `package.json`（独立 `apps/desktop/package.json`）。

## 3. 现有代码接点

| 接点 | 位置 |
|---|---|
| 配置 | `runtime/config.mjs`（`FDE_APP_ROOT/FDE_RESOURCES/FDE_DSH_BIN/FDE_DSH_HOME/FDE_VENDOR_DIR/FDE_SEMANTIC_RUNTIME_SRC/...`）、`docs/RUNTIME-CONFIG.md` |
| DSH 拉起 | `dsh-core.mjs` L241–247 `dsh web --profile fde-x --patch … --host 127.0.0.1 --port 0`；profile `ensureIsolatedProfile` L354–381（bundles、bridge 链接） |
| semantic 拷贝 | `dsh-core.mjs` L384–441（`ownedSemanticRuntime` 强制自有拷贝；源 `~/.dsh/semantic-os/runtime` 或 `vendor/.../runtime-dist/<platform-arch>`）；sidecar `DSH_SEMANTICA_PYTHON` |
| 监督重启 | `server.mjs` L16–29 `scheduleRuntimeRestart` → `process.exit(0)`；`scripts/dev.mjs` L78–90 |
| 目录选择 | `server.mjs` L32–37 `pickLocalDirectory`（darwin `osascript`，其它平台 501） |
| 静态服务 | `server.mjs` **无** SPA/静态目录服务（仅 L2210 附件 `createReadStream`），需新建 |
| 静态前端 | 现由 Vite dev 服务；`vite.config.ts` 代理 `/api /dsh-app /lan-assist /semantic-os /plugins`；`pnpm build` 出 `dist/` |
| Origin 白名单 | `runtime/config.mjs` L93–111 `parseAllowedOrigins`（`server.mjs` L210 使用） |
| 官方 runtime 资产 | https://github.com/losebird/dsh-semantic-os/releases/tag/v0.1.1（darwin-arm64 / win32-x64 / linux-x64 / linux-arm64 tar.gz + sha256）；workflow `.github/workflows/runtime-packages.yml`；installer `runtime-install.js`（staging → treeHash → rename → 回滚） |
| Windows 限制 | `falkordblite` 排除 win32 → 图存储文件模式 |

## 4. 目录与资源布局

```
apps/desktop/
  package.json            electron, electron-builder, electron-updater
  src/main.ts             主进程：窗口、生命周期、BFF 子进程、更新、对话框 IPC
  src/preload.ts          contextBridge：pickDirectory、openExternal、appInfo
  electron-builder.yml    按平台目标；extraResources 见下
resources/（打包时由 scripts/pack 生成）
  app/                    dist/（前端）+ runtime/（BFF、bridge、presets、migrations）
  node/                   Node 22 二进制（或用 Electron 自带 node 运行 BFF：ELECTRON_RUN_AS_NODE=1）
  dsh/                    @deepseek-ai/dsh npm 树（含平台原生 .node）
  plugins/dsh-lan-assist/
  plugins/dsh-semantic-os/
  semantic-runtime/<platform-arch>/   官方 runtime-dist 解包（可选组件）
  LICENSES/ NOTICE.md
```

用户数据目录（ASCII，`FDE_DSH_HOME`）：mac `~/Library/Application Support/FDE-X/dsh-home`；Windows `%LOCALAPPDATA%\FDE-X\dsh-home`；Linux `~/.local/share/fde-x/dsh-home`。SQLite `…/FDE-X/data/fde-workstation.sqlite`。

## 5. 运行时契约

主进程启动序列：
1. 解析 `resources` 路径 → 设置 env：`FDE_APP_ROOT=resources/app`、`FDE_RESOURCES=resources`、`FDE_DSH_BIN=resources/dsh/bin/dsh(.cmd)`、`FDE_VENDOR_DIR=resources/plugins`、`FDE_SEMANTIC_RUNTIME_SRC=resources/semantic-runtime/<platform-arch>`、`FDE_DSH_HOME=<用户目录>`、`FDE_DATABASE_PATH`、`FDE_RUNTIME_PORT=0`（动态）、`FDE_ALLOWED_ORIGINS=app://fde-x,http://127.0.0.1:<port>`、`FDE_STATIC_DIR=resources/app/dist`。
2. 首启检查 `<FDE_DSH_HOME>/install-state.json`：无 → 显示初始化窗口（进度：创建目录 → 校验 semantic runtime treeHash → **不拷贝**，直接指向只读 resources（改 `dsh-core.mjs` L430–441：`FDE_SEMANTIC_RUNTIME_MODE=readonly` 时跳过自有拷贝，cache 指向用户目录）→ 写 profile → 完成）。
3. spawn BFF：`node resources/app/runtime/server.mjs`（`ELECTRON_RUN_AS_NODE=1` 用 Electron 内置 node），读 stdout 第一行 `FDE_LISTENING <port>`（`server.mjs` 加这一行输出）。
4. BFF 服务静态前端：`server.mjs` 新增 `FDE_STATIC_DIR` 时挂 `GET /*` → `dist/`（SPA fallback），并把现 Vite 代理的路径前缀在 BFF 内直接处理（已是）。
5. 窗口 `loadURL('http://127.0.0.1:<port>/ai')`。
6. 生命周期：窗口全关 → 保留 BFF 60s 后退出（mac Dock 保留）；`before-quit` → `POST /api/v1/ai/shutdown`（新增，优雅停 DSH）→ kill 子进程树。BFF 崩溃 → 主进程重拉（指数退避，3 次后弹错误窗口带日志路径）。
7. 「重载核心」（`POST /api/v1/ai/reload` → `process.exit(0)`）在 Electron 下由主进程接管重拉（替代 `dev.mjs` 监督）。
8. 目录选择：`server.mjs` L34 `osascript` 路径改为：请求带 `x-fde-desktop: 1` 时返回 501 `use_desktop_picker`，前端检测 `window.fdeDesktop` 走 preload `pickDirectory()`。

Windows 特化：`dsh.cmd`；junction 已由 config 提交处理；ASCII 数据目录；`semantic` 图存储 `FDE_SEMANTIC_GRAPH_MODE=file`（传给 sidecar env，若 semantic-os 支持；不支持则记忆页显示「Windows 上图能力为文件模式」）；Long Path 注册表提示写进安装器说明。

## 6. 打包流水线（`.github/workflows/desktop.yml`）

matrix：`macos-14`(arm64)、`macos-13`(x64，可选)、`windows-2022`(x64)、`ubuntu-24.04`(x64)。步骤：
1. `pnpm i && pnpm build`（前端）。
2. `scripts/pack/stage.mjs`：`npm pack @deepseek-ai/dsh@<锁定版本>` 并 `npm i --omit=dev` 到 `resources/dsh`；拷 `vendor` 插件（从 git 子模块或 npm）；下载官方 semantic runtime tar.gz + 校验 sha256 → 解包到 `resources/semantic-runtime/<key>`；生成 `NOTICE.md`（合并 `LICENSES/python-distributions.json` + npm `license-checker`）。
3. `electron-builder --<platform>`：mac `dmg`+`zip`（签名 `CSC_LINK`、公证 `APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD`）；win `nsis`（Authenticode `WIN_CSC_LINK`）；linux `AppImage`+`deb`。
4. 产物上传 Release；`latest.yml` 供 electron-updater。
5. 可选组件：`--config.extraResources` 两套 → 出「完整版」和「精简版（无语义引擎）」。

版本锁定：`resources/versions.json`（dsh、lan-assist、semantic-os plugin、semantic runtime `runtimeVersion/key/digest`）。

## 7. 自动更新

- 壳与 app：electron-updater 标准流程。
- semantic runtime：独立 `runtime-manifest.json`，更新时下载 tar.gz → staging → treeHash → 切换 `current.json`（复用官方 `runtime-install.js` 逻辑）；失败保留旧版。
- DSH/插件：随 app 包更新（体积 ~330 MB，接受）。

## 8. 错误与降级

- semantic runtime 缺失/校验失败 → 启动继续，记忆页「语义引擎未安装/损坏 → 重新安装」按钮（触发组件更新流程）。
- DSH 起不来 → 主窗口显示 BFF 的 boot-failed 页面（现有 `ai/boot-failed`），带「打开日志目录」。
- 端口被占（动态端口应不会）→ 重试 3 次。
- 未签名运行（开发者构建）→ 文档说明右键打开。

## 9. 验收清单

P1（mac arm64）：
1. 干净 Mac（新用户账号）双击 DMG 安装 → 启动 → 初始化窗口 → 主窗口绿条「已连接本地核心」；`~/Library/Application Support/FDE-X/dsh-home` 存在，`profiles/fde-x` 正确。
2. 未装 Homebrew / 无全局 dsh / 无 pnpm 的账号下同样成功（证明零依赖）。
3. 记忆页语义就绪（`/semantic-os/ready` true）；搜索可用。
4. IM 与另一台（或 dev peer）配对收发正常。
5. 关闭窗口 → 60s 后进程全部退出（`ps` 无 dsh/python 残留）。
6. 「重载核心」→ 重新连接成功。
7. 公证通过（`spctl -a -vv` 接受）。
8. `pnpm dev` 开发态照常。

P2（Windows x64）：同 1–6（`%LOCALAPPDATA%\FDE-X`；无 WSL/Docker 的机器上记忆页显示图文件模式，向量搜索可用）；SmartScreen 不拦（签名）。

自动化：`apps/desktop/test/` 用 Playwright-Electron 起应用 → 等绿条 → 截图；`scripts/pack/verify.mjs` 校验 resources 完整性与 versions.json。

## 10. 提交拆分

1. `feat(runtime): FDE_STATIC_DIR static serving + FDE_LISTENING line + /ai/shutdown`
2. `feat(runtime): readonly semantic runtime mode`
3. `feat(desktop): electron main/preload skeleton, spawn BFF, window`
4. `feat(desktop): first-run init + user data dirs`
5. `feat(pack): stage.mjs (dsh/plugins/semantic/NOTICE) + versions.json`
6. `ci: desktop matrix build + release upload`
7. `feat(desktop): auto-update + component update for semantic runtime`
8. `feat(desktop): windows specifics (dsh.cmd, ascii dirs, graph file mode)`
9. `docs: install & build guide`

## 11. 开放问题

**已核实**：semantic-os 没有只读 runtime / 可写 cache 的一等 env；`ensure-deps.js` L58–60 注释说 bundled runtime 视为只读、可写 cache 靠 spawn 时的 `opts.env`；工作区数据在 `{cwd}/.dsh/semantic-os/`。**决定**：P1 先走首启拷贝（复用官方 `runtime-install.js` staging → treeHash → rename，初始化窗口显示进度，一次性 1.8 GB）；只读模式作为 P4 优化，需在 `dsh-core.mjs` L430–441 与 sidecar spawn env 两处实现并验证。§5 第 2 步据此调整。
- 是否同时出 darwin-x64：官方 runtime 无该资产，需自建；默认先不出。
