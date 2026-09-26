---
cursor:
  subagentId: "bc-41a334e9-728a-5d81-9887-87b7a0a8d142"
---

# Wave 5 · Spec 09 · P1 commits 1–5 只读审查

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**范围**：`e5d328c` … `3a00320`（规格 §10 提交 1–5）  
**审查时间**：2026-09-17（未起 Electron、未停 Ace 主栈 5174/4318）

## 结论

**裁决：需小修** — 五条提交的方向与规格 P1 脚手架一致，runtime/desktop/pack 接点可保留；在宣称 P1 验收或出 DMG 前必须补齐下列 must-fix，并等 Ace 对 §11 copy vs readonly、CI dsh 树、POC vs 干净机 拍板。

## 提交对照

| # | SHA | 规格关切 | 审查 |
|---|-----|----------|------|
| 1 | `e5d328c` | 静态、`FDE_LISTENING`、`/ai/shutdown`、desktop picker 501、动态 Origin | 已对：`runtime/config.mjs` 仅 env 设 `FDE_STATIC_DIR`；`runtime/routes/static.mjs`；`server.mjs` L2592–2597、`L1092–1107`、`L1414–1417`；listen 后 `allowedOrigins.add` 动态端口 |
| 2 | `707fc94` | readonly semantic | 已对：`FDE_SEMANTIC_RUNTIME_MODE` + `dsh-core.mjs` `ensureSharedSemanticRuntime` readonly 分支；`findSemanticRuntimeSource` flat `runtime-manifest.json`（L616–619） |
| 3 | `b11e739` | Electron 仅 `apps/desktop` | 已对：`apps/desktop/package.json` 含 electron；根 `package.json` 无 electron；`bff.ts` + `ELECTRON_RUN_AS_NODE` + `FDE_LISTENING` 解析 |
| 4 | `3b19de2` | 首启目录 | 已对：`paths.ts` `~/Library/Application Support/FDE-X/{dsh-home,data}`；`first-run.ts` `install-state.json` |
| 5 | `3a00320` | stage/verify | 部分：`scripts/pack/stage.mjs` / `verify.mjs`；`resources/.gitignore`；本机 `versions.json` 显示 `dsh.staged: false`（stub） |

## 规格核对表

| 项 | 母体（spec / design） | fdex（本 checkout） | 状态 |
|----|----------------------|---------------------|------|
| `FDE_STATIC_DIR` 仅显式启用 | §5.4、§3 禁区 dev 不变 | 默认 `''`（`config.mjs` L45–47）；`scripts/dev.mjs` 未设置 | 已对 |
| `FDE_LISTENING` + shutdown | §5.3、§5.6 | stdout `FDE_LISTENING ${actualPort}`；`POST /api/v1/ai/shutdown` → `close()` → `aiRuntime.stop()` | 已对 |
| Wave 1–4 路由挂载 | 协议 §3 | `server.mjs` 仍 import/mount `plan/presets/mcp/events/apps/biz/bridge/context/corpus/briefing` | 已对 |
| Electron 不在根 package | §2 禁区 | 仅 `apps/desktop/package.json` | 已对 |
| 首启用户目录 | §4、§5.2 | `userDataRoots()` + `ensureFirstRun` | 已对（POC 文案，无 treeHash 进度） |
| stage / verify | §6 step 2 | `stage.mjs` 拷 runtime/dist/vendor/本地 semantic；无 `npm pack` dsh；`verify.mjs` 最低文件集 | 仍差：dsh 真树；NOTICE 为 POC 一行 |
| dsh stub vs 真树 | packaging-design §2 | `resources/versions.json` → `dsh.staged: false`；`README-STUB.txt` 路径存在 | 仍差（Ace/CI） |
| readonly vs §11 首启拷贝 | spec §11 决定 copy；§5.2 曾写 readonly | desktop `FDE_SEMANTIC_RUNTIME_MODE: readonly`；`first-run` note 明确跳过 1.8GB | **偏离已文档化**：实现走 readonly POC，非 §11 copy + `runtime-install.js` |
| Origin + desktop picker 501 | §5.8 | BFF `x-fde-desktop: 1` → 501 `use_desktop_picker`；preload `window.fdeDesktop` | 仍差：**前端未接**（见 must-fix） |
| P1 验收 1–7 / DMG | §9 | 现网未测 Electron/DMG/干净机/公证/60s ps | 未对 |

## 验证（本审查执行）

| 步骤 | 结果 |
|------|------|
| `npx tsc -b --pretty false` | 退出 0 |
| `node runtime/smoke.mjs` | 退出 0（自起 BFF，未动 4318） |
| `node --check` `static.mjs` / `stage.mjs` / `verify.mjs` | 通过 |
| `curl http://127.0.0.1:4318/health` | 200 |
| `curl http://127.0.0.1:4319/health` | 200 |
| `node scripts/pack/stage.mjs` | **未跑**（脚本固定写入仓库 `resources/`，会覆盖 Ace 已 stage 树；已读脚本做 dry-check） |
| `node scripts/pack/verify.mjs` | 通过（`darwin-arm64`，semantic `complete: true`，dsh stub） |

## Must-fix（合并后下一迭代）

1. **`src/lib/runtime-api.ts`**（及调用「选工作区目录」的 UI）：在 Electron 下检测 `window.fdeDesktop`，走 `pickDirectory()`；对 BFF 路径发送 `x-fde-desktop: 1`（或不再调 BFF pick）。否则规格 §5.8 与 501 契约在前端悬空；非 mac 桌面版仍会误走 `osascript`/501。
2. **`scripts/pack/stage.mjs`**：实现规格 §6 的 `npm pack @deepseek-ai/dsh@<pin>` + `npm i --omit=dev` 到 `resources/dsh`（或 CI 注入 `FDE_DSH_NPM_TREE` 并文档化）；当前 `dsh.staged: false` 无法支撑「零全局 dsh」验收。
3. **`apps/desktop/src/main.ts`**：`buildBffEnv` 未设 `FDE_ALLOWED_ORIGINS`（规格 §5.1 含 `app://fde-x`）；现依赖 listen 后补 loopback Origin，**锁**内可接受 POC，但打包后若改 custom protocol 会 403 写操作。
4. **§11 语义首启**：若 Ace 坚持干净机 copy 路径，需接 `runtime-install.js` 进度 UI，且勿默认 readonly；若接受 POC readonly，应在 spec/验收清单显式降级 P1 条目（Ace 未决）。

## 非阻断仍差（commits 6–9 / 验收）

- `apps/desktop/src/main.ts`：BFF 崩溃指数退避重拉、错误窗（§5.6）未实现。
- `electron-builder.yml` 存在但未验 DMG/签名/`spctl`。
- `stage.mjs` 不下载官方 semantic tar.gz（设计允许 POC 用本地树）；干净机 semantic stub → `/semantic-os/ready` 未对。
- `first-run.ts` 不写 semantic `install-state.json` treeHash 流程（与官方 installer 语义不同）。

## 需要 Ace 决定（仍开放）

- CI 是否固定 `npm pack` dsh + Release 下载 semantic runtime（vs 本机 vendor/`.dsh`  symlink 源）。
- P1 验收是否接受「开发机 Electron POC + readonly」直至 commit 6 DMG 流水线。
- §11：**首启 1.8GB copy** vs **readonly + bundled `FDE_SEMANTIC_RUNTIME_SRC`** 哪条算 P1 真值（实现已偏向后者）。

## 已对 / 未对 / 仍差（摘要）

- **已对**：静态与 listen/shutdown 契约；dev 默认不变；Wave 1–4 路由；Electron 隔离；readonly + flat semantic 探测；桌面路径与首启 JSON；pack 脚本骨架；自动化底线 tsc/smoke/node --check；主/peer health 200。
- **未对**：干净 Mac DMG、零依赖、记忆 ready、60s 无残留、Electron 绿条（现网未测）。
- **仍差**：dsh stage 真树、前端 fdeDesktop、完整 NOTICE/CI matrix、§11 copy 路径。
