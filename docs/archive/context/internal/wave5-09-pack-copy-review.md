---
cursor:
  subagentId: "bc-aed2de06-b796-5eb5-ab9d-f94adb146e81"
---

# Wave 5 · Spec 09 · Pack + P1 first-run 只读审查

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**审查提交**：`d0cf3a9` · `84fb4cf` · `6a72f79`（`main` HEAD `6a72f79`）  
**审查时间**：2026-09-17 · 未起 Electron、未跑 stage 覆盖 repo `resources/`、未触发 GHA

## 裁决

**需小修** — Ace 决策 #12/#13 与 pack/first-run 主路径已在代码中对齐，三条提交可保留；合并前建议补齐 **semantic runtime 在 CI 下的硬失败**（与 DSH 对称），否则 GHA 可能在 semantic 下载失败时仍绿跑并上传 stub 资源。

## 提交对照

| SHA | 关切 | 结论 |
|-----|------|------|
| `d0cf3a9` | P1 首启 semantic 拷贝 + 进度 | **保留** — 见 §First-run |
| `84fb4cf` | `npm pack` 真 dsh 树 + pins/verify | **保留** — 见 §Pack |
| `6a72f79` | `desktop.yml` macos-14 stage/verify | **保留** — 见 §CI；semantic 失败路径见 gaps |

**隔离**：`84fb4cf` / `6a72f79` **未**修改 `first-run.ts` · `semantic-runtime.ts` · `install-state.ts` · `main.ts`（`git log 84fb4cf^..6a72f79 -- apps/desktop/src/{first-run,semantic-runtime,install-state,main}.ts` 为空）。

## Ace 决策核对

| # | 决策 | 证据 | 状态 |
|---|------|------|------|
| 12 | CI 真 `@deepseek-ai/dsh` npm 树；npm 失败不回落 stub | `stage.mjs` L74–116 `npm pack` + wrapper `npm i --omit=dev`；L133–136 `CI===true` 时 `throw`；L170–176 仅非 CI 写 `README-STUB.txt`；`verify.mjs` L40–44 要求 `bin/dsh` + `versions.dsh.staged === true`；`pins.mjs` 锁 `0.1.5-rc.1`；`FDE_DSH_NPM_TREE` / `FDE_PACK_OUT`（`README.md`） | **已对** |
| 13 | P1 首启 1.8GB 拷贝（`runtime-install.js` staging→treeHash→rename + 进度）；打包默认非 readonly；`FDE_DESKTOP_DEV=1` 可跳过 | `main.ts` L36–38 无 `FDE_SEMANTIC_RUNTIME_MODE`；L61 `skipSemanticCopy = FDE_DESKTOP_DEV===1`；`semantic-runtime.ts` L106 `installRuntimeFromDirectory` + L110 `resolveInstalledRuntime({verifyFiles:true})`；`first-run.ts` L48–60 treeHash 决策 + `install-state` 写入；`d0cf3a9` 删除 `FDE_SEMANTIC_RUNTIME_MODE: 'readonly'` | **已对（代码接点）** |

## Pack（`84fb4cf`）

| 检查项 | 位置 | 状态 |
|--------|------|------|
| `dsh.staged: true` 仅真树 | `stageDsh` 返回 `true` 仅 npm/override/本地候选成功；`verify.mjs` L18–23 + L34 | 已对 |
| `FDE_DSH_NPM_TREE` | `stage.mjs` L119–126 | 已对 |
| `FDE_PACK_OUT` | `stage.mjs` L20–22；`verify.mjs` L8–10 | 已对 |
| 版本 pin | `pins.mjs` `DSH_NPM_VERSION` | 已对 |
| NOTICE 完整生成 | `stage.mjs` L392–395 一行 POC | 仍差（非 Ace 阻断；spec §6 后续） |

## CI（`6a72f79`）

| 检查项 | 位置 | 状态 |
|--------|------|------|
| `macos-14` / `darwin-arm64` | `desktop.yml` L27–28 | 已对 |
| `pnpm build` → stage → verify | L49–59 | 已对 |
| semantic tar + sha256 | `stage.mjs` L235–248 `downloadSemanticRuntime` | 已对（代码） |
| DSH npm 失败不 silent stub | `stage.mjs` L133–136 | 已对 |
| semantic 失败不 silent stub | `stage.mjs` L302–304 `catch` 仅 `warn` 后回落 stub；`verify.mjs` L36–37 仅 `warn` | **仍差** |
| electron-builder / 公证 | `CSC_LINK` 空则 skip（L76–78） | 预期占位；未验 |
| GHA 绿跑 | — | **未对**（不记为代码缺陷） |

## First-run（`d0cf3a9`）

| 检查项 | 位置 | 状态 |
|--------|------|------|
| 官方 `runtime-install.js` | `semantic-runtime.ts` L68–74 import `plugins/dsh-semantic-os/runtime-install.js` | 已对 |
| `install-state.json` + `treeHash` | `first-run.ts` L58–59；`buildInstallStatePayload` L135–141 | 已对 |
| 仅 DEV 跳过拷贝 | `main.ts` L61；`shouldRunSemanticInstall` L51 | 已对 |
| 进度 UI | `main.ts` L70–77 步骤文案（无字节级进度 — 官方 installer 无回调） | 已对（文案级） |
| 干净机 1.8GB 全量拷贝 | — | **未对**（不记为代码缺陷） |
| `/semantic-os/ready` | — | **未对** |

## 测试（本审查未重跑）

| 项 | 依据 |
|----|------|
| `apps/desktop` `semantic-install-plan.test.mjs` | agent 报告 3/3；`d0cf3a9` 新增 |
| `/tmp` stage + verify | `wave5-09-dsh-stage.md` 已记录 `dsh.staged: true` |

## 真实缺口（仅列可证）

1. **CI semantic 下载失败仍可能绿跑** — `stageSemantic()` 在 `shouldDownloadSemantic` 时 catch 后不 `throw`（`stage.mjs` L302–304），干净 runner 无本地/vendor 源时会 `writeStubSemantic()`（L346–347）；`verify.mjs` 不因 `semanticRuntime.complete === false` 退出。与 DSH 的 CI 硬失败不对称，也与审查项「no silent stub」不符；会导致资源包无有效 `treeHash`，首启跳过安装（`readBundledRuntimeManifest` 返回 `null`），语义能力不可用而 CI 仍通过。
2. **NOTICE.md** — 仍为 POC 一行（`stage.mjs` L392–395）；spec §6 完整 `license-checker` 未做（非 Ace #12/#13）。
3. **未验证（非缺陷）** — GitHub Actions 实际运行；semantic release 下载在匿名环境；1.8GB 首启拷贝耗时；DMG / `spctl` / Electron 绿条 / `ps` 无残留。

## 相对 `wave5-09-review.md`（commits 1–5）已闭合项

- DSH stub → 真 npm 树（`84fb4cf`）
- 默认 readonly → 首启拷贝（`d0cf3a9`）
- `fdeDesktop` / `app://` — 已在更早提交 `1de8343` / `02cb78b`（**不在本次三提交范围**，但 `main` 已含）

## 建议下一刀（小修）

- `stage.mjs`：`shouldDownloadSemantic && CI` 时 semantic 下载失败 `throw`（与 L135 DSH 一致）。
- `verify.mjs`：当 `CI===true` 或 `FDE_DOWNLOAD_SEMANTIC_RUNTIME===1` 时，`semanticRuntime.complete !== true` → `exit 1`。
