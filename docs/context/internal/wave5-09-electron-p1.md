---
cursor:
  subagentId: "bc-8f89edd1-5f59-5076-824c-a9ab254e61ae"
---

# Wave 5 · Spec 09 · P1 mac POC（commits 1–5）

## 改动（提交）

| # | SHA | 说明 |
|---|-----|------|
| 1 | `e5d328c` | `feat(runtime): FDE_STATIC_DIR` + `runtime/routes/static.mjs` SPA；`FDE_LISTENING <port>`；`POST /api/v1/ai/shutdown`；`x-fde-desktop: 1` → 501 `use_desktop_picker`；动态端口写入 Origin 白名单 |
| 2 | `707fc94` | `FDE_SEMANTIC_RUNTIME_MODE=readonly` 跳过 1.8GB 拷贝；flat `FDE_SEMANTIC_RUNTIME_SRC` 树探测 |
| 3 | `b11e739` | `apps/desktop/` Electron 主进程/preload、spawn BFF（`ELECTRON_RUN_AS_NODE`）、窗口加载 `/ai` |
| 4 | `3b19de2` | 首启 `install-state.json`；用户目录 `~/Library/Application Support/FDE-X/{dsh-home,data}` |
| 5 | `3a00320` | `scripts/pack/stage.mjs` + `verify.mjs`；`resources/.gitignore`（产物不入库） |

未做（规格 §10 6–9 / P1 验收 1–7）：CI matrix、electron-builder DMG、签名公证、auto-update、Windows 特化、完整 install 文档提交。

## 验证

| 步骤 | 结果 |
|------|------|
| `npx tsc -b --pretty false` | 通过 |
| `node --check` 改动 `.mjs` | 通过 |
| `node runtime/smoke.mjs` | 通过（未停 Ace 主栈） |
| `node scripts/pack/stage.mjs` + `verify.mjs` | 通过；本机有 `~/.dsh/semantic-os/runtime` 时 semantic `complete: true`，否则 stub |
| `apps/desktop` `pnpm run build` | 通过（需 `cd apps/desktop && npm install` 装 Electron，**未**写入根 `package.json`） |
| Electron 端到端双击 DMG / 绿条 / 记忆 ready | **现网未测**（未出 DMG；未起 Electron 以免干扰 5174/4318） |

## 如何跑 Desktop POC（开发机）

```bash
# 仓库根
pnpm build
node scripts/pack/stage.mjs

cd apps/desktop
npm install          # 仅 apps/desktop 本地依赖
pnpm run build
FDE_DESKTOP_DEV=1 pnpm run start   # BFF 读仓库 runtime/ + dist/，resources 仍用于 plugins/semantic
```

打包形态（未验）：`electron-builder -c electron-builder.yml` 需已 stage 的 `resources/`。

## 未对 / 仍差

- **未对**：干净 Mac DMG 安装、零 Homebrew 验收、公证 `spctl`、60s 退出无残留 `ps`、记忆 `/semantic-os/ready` 在只读 stub 下就绪。
- **仍差**：`stage.mjs` 在本机未自动打入 `@deepseek-ai/dsh` npm 树（`resources/dsh/README-STUB.txt`）；需 Ace/CI 提供 `FDE_DSH_NPM_TREE` 或 `npm pack` 流程。
- **仍差**：§11 首启 **copy** 路径（1.8GB）未接初始化 UI 进度；P1 默认 **readonly** + 复用本机已有 runtime（stage 拷贝 symlink 源），非干净机无 runtime 时语义引擎不可用。
- **锁**：未改 `pnpm dev` / `dev:peer` 默认 env；`FDE_STATIC_DIR` / shutdown 仅 Electron 或显式 env 启用。

## 需要 Ace 决定

- 是否在 CI 中固定 `npm pack @deepseek-ai/dsh@<pin>` 与 semantic runtime 下载（当前 stage 不下载 1.8GB）。
- P1 验收是否接受「开发机 POC + readonly」替代「干净账号 + 首启拷贝」直至 DMG 流水线就绪。
