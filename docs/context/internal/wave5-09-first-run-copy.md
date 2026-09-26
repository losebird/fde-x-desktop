---
cursor:
  subagentId: "bc-82523c7e-49ce-5b46-8239-f4d9515b86bc"
---

# Wave 5 · Spec 09 · 首启 semantic runtime 拷贝

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**决策**：Ace §11 — P1 首启必须 `runtime-install.js`（staging → treeHash → rename），非默认 `readonly`。

## 改动

| 文件 | 作用 |
|------|------|
| `apps/desktop/src/semantic-runtime.ts` | 读 bundled `treeHash`；`shouldRunSemanticInstall`；动态 import 官方 `runtime-install.js`（`DSH_HOME=FDE_DSH_HOME`） |
| `apps/desktop/src/first-run.ts` | 首启编排：缺 `install-state` / treeHash 不一致 / `resolveInstalledRuntime` 失败 → 安装 |
| `apps/desktop/src/install-state.ts` | `readInstallState` 拆分 |
| `apps/desktop/src/main.ts` | 去掉 `FDE_SEMANTIC_RUNTIME_MODE=readonly`；进度文案；`FDE_DESKTOP_DEV=1` 跳过拷贝 |
| `apps/desktop/test/semantic-install-plan.test.mjs` | treeHash + install-state 决策 + installer 接点 |
| `apps/desktop/package.json` | `pnpm test` |

**未改**：`scripts/pack/stage.mjs`、`runtime/dsh-core.mjs`（BFF 仍可在非 readonly 下自有拷贝，首启由主进程先装到 `FDE_DSH_HOME/semantic-os/runtime`）。

## 规格对照（§11 / §5.2 调整后）

| 项 | 母体 | fdex | 状态 |
|----|------|------|------|
| 首启拷贝非 readonly | spec §11；§5.2 经 §11 调整 | `main.ts` 不再设 `FDE_SEMANTIC_RUNTIME_MODE` | 已对 |
| `runtime-install.js` staging→校验→rename | `resources/plugins/dsh-semantic-os/runtime-install.js` | `installSemanticRuntimeFromBundled` → `installRuntimeFromDirectory` | 已对（代码接点） |
| `install-state.json` + treeHash | 首启检查缺失/不一致 | `dsh-home/install-state.json` 含 `semanticRuntime.treeHash` | 已对 |
| 进度 UI | 初始化窗口 | `main.ts` 步骤：目录→探测→校验→安装 1.8GB→treeHash→写状态 | 已对（文案，无字节级进度） |
| `FDE_DESKTOP_DEV=1` 跳过拷贝 | 任务说明 | `skipSemanticCopy` + `semanticCopySkipped` | 已对 |
| 干净机 DMG / 记忆 ready | §9 P1 | 现网未测 Electron | 未对 |
| 实际 1.8GB 拷贝耗时 | — | 本机未跑 `installRuntimeFromDirectory` 全量（已有 staged 树，避免双份占用） | 未对 |

## 验证

| 步骤 | 结果 |
|------|------|
| `npx tsc -b --pretty false`（仓库根） | 退出 0 |
| `cd apps/desktop && pnpm run test` | 3/3 通过 |
| Electron 起主窗口 / DMG | 未跑（禁 5174/4318 干扰；未起 Electron） |

## 提交

- 信息：`feat(desktop): first-run semantic runtime copy with progress`
- add 范围：`apps/desktop/package.json`、`src/{first-run,main,install-state,semantic-runtime}.ts`、`test/semantic-install-plan.test.mjs`

## 仍差

- 打包后真机首启全量拷贝与 `/semantic-os/ready`（需 DMG + 干净 `FDE_DSH_HOME`）。
- 初始化窗口无逐文件进度（官方 installer 无回调；未发明）。
- 旧 POC `install-state`（`semanticRuntimeMode: readonly`）会触发重装（treeHash 字段缺失）— 预期行为。
