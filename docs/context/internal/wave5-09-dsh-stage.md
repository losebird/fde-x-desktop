---
cursor:
  subagentId: "bc-9810a141-d54b-52df-abc1-5de2cf84269c"
---

# Wave 5 · Spec 09 §6 · DSH npm stage + CI

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**基线**：`d0cf3a9`（首启拷贝，未改 `first-run.ts` / `main.ts`）  
**本 agent 提交**：`84fb4cf` `feat(pack): npm pack real dsh tree into resources/dsh` · `6a72f79` `ci: desktop stage dsh + semantic runtime`

## 做了什么

| 项 | 说明 |
|----|------|
| `scripts/pack/pins.mjs` | 锁定 `@deepseek-ai/dsh@0.1.5-rc.1`、semantic runtime `0.1.1` / release URL |
| `scripts/pack/stage.mjs` | `npm pack` + 在 bundle 目录 `npm i --omit=dev` → 拷到 `resources/dsh`；写 `bin/dsh` shim（满足 `FDE_DSH_BIN=…/dsh/bin/dsh`）；`FDE_DSH_NPM_TREE` / `FDE_PACK_OUT`；CI 下 npm 失败不回落 stub |
| `scripts/pack/verify.mjs` | 要求 `bin/dsh` + `versions.dsh.staged === true`，打印 `dsh.staged: true` |
| `scripts/pack/versions.schema.json` + `README.md` | versions.json 字段与 env 文档 |
| `.github/workflows/desktop.yml` | `macos-14`：`pnpm build` → `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1` stage → verify → desktop `npm run build`；无 `CSC_LINK` 时跳过 electron-builder；签名 secret 占位 |

## 验证（本机，未写 repo `resources/`）

| 步骤 | 结果 |
|------|------|
| `node --check` stage/verify/pins | 通过 |
| `FDE_PACK_OUT=/tmp/fde-pack-dsh-test FDE_DOWNLOAD_SEMANTIC_RUNTIME=0 node scripts/pack/stage.mjs` | `dsh.staged: true`；`dsh/bin/dsh` 可执行；`node_modules/@deepseek-ai/dsh` 存在 |
| `FDE_PACK_OUT=… node scripts/pack/verify.mjs` | `dsh.staged: true (version 0.1.5-rc.1)`，exit 0 |

**注**：曾在 tarball 内直接 `npm i` 触发 `@deepseek-ai/dsh-experimental-code-runtime-python` 404；已改为 wrapper `package.json` 依赖安装（与干净 `npm i @deepseek-ai/dsh` 一致）。

## 未对 / 仍差

| 项 | 状态 |
|----|------|
| GitHub Actions 绿跑 | 未在本环境触发；semantic release URL 对匿名 API 曾 404，CI 以 release 上 `*.tar.gz` + `.sha256` 为准 |
| 仓库内 `resources/versions.json` | `resources/.gitignore` 忽略；本机仍为 Ace 旧 stage（未重跑 stage 以免覆盖运行栈） |
| electron-builder DMG / 公证 | workflow 仅在 secret 齐全时执行 |
| 未改 | `apps/desktop/src/first-run.ts`、`semantic-runtime.ts`、`install-state.ts`、`main.ts`；未恢复 `FDE_SEMANTIC_RUNTIME_MODE=readonly` |

## 对照（仅本任务范围）

| 行 | 母体 | fdex | |
|----|------|------|--|
| §6 step 2 dsh | `npm pack` + `npm i --omit=dev` → `resources/dsh` | `stage.mjs` + `pins.mjs` | 已对（代码 + `/tmp` 实测） |
| §6 CI macos-14 arm64 | matrix + stage | `desktop.yml` | 已对（workflow 已提交，现网未测） |
| `verify.mjs` `dsh.staged: true` | §9 自动化 | verify 硬失败无 bin | 已对（temp out） |
