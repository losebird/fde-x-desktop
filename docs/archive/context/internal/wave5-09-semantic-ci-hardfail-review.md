---
cursor:
  subagentId: "bc-035645e3-04c5-55b5-a534-7f3fb1bd5d4d"
---

# Wave 5 · Spec 09 · Semantic CI hard-fail spot-check

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**审查提交**：`75e9ebe` — `fix(pack): fail CI when semantic runtime stage is incomplete`  
**依据**：`internal/wave5-09-pack-copy-review.md` §建议下一刀 · `internal/wave5-09-semantic-ci-hardfail.md`  
**方式**：只读（`git show` + 工作区 `stage.mjs` / `verify.mjs` 全文核对）；未跑 stage 下载、未改代码、未提交。

## 裁决

**合并保留** — 与 gap #1 /「下一刀」一致：`75e9ebe` 仅改 `scripts/pack/stage.mjs`、`scripts/pack/verify.mjs`；在 `CI=true` 或 `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1` 时，semantic **下载路径**失败会 `throw`，`verify` 对 `semanticRuntime.complete !== true` 会 `exit 1`；本地无上述标志时仍为 warn-only。未触及 `apps/desktop` 首启链路，未恢复 `FDE_SEMANTIC_RUNTIME_MODE=readonly`。

## 提交范围

| 检查 | 结果 |
|------|------|
| `git show 75e9ebe --name-only` | 仅 `scripts/pack/stage.mjs`、`scripts/pack/verify.mjs` |
| `apps/desktop` first-run / semantic-runtime / install-state / main | **未改**（本提交无 diff） |
| `FDE_SEMANTIC_RUNTIME_MODE` in `apps/desktop/src` | **无匹配** |

## MUST BE TRUE 核对

### 标志定义（两文件一致）

```34:35:scripts/pack/stage.mjs
const requireSemanticRuntimeComplete =
  process.env.CI === 'true' || process.env.FDE_DOWNLOAD_SEMANTIC_RUNTIME === '1'
```

```18:19:scripts/pack/verify.mjs
const requireSemanticRuntimeComplete =
  process.env.CI === 'true' || process.env.FDE_DOWNLOAD_SEMANTIC_RUNTIME === '1'
```

`shouldDownloadSemantic`（L30–32）：`FDE_DOWNLOAD_SEMANTIC_RUNTIME === '1'` **或**（`!== '0'` 且 `CI === 'true'`）。GHA 典型为 `CI=true` + workflow 设 `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1`，会走下载分支。

### CI / `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1` — stage 硬失败、无 stub 回落

| 失败点 | 行为 | 证据 |
|--------|------|------|
| fetch sha / archive | `downloadSemanticRuntime` 内 `fetchText` / `fetchBuffer` 抛错 | `stage.mjs` L245–247 |
| sha256 不匹配 | `throw new Error('semantic runtime sha256 mismatch…')` | L249–250 |
| extract / manifest | `extractTarGz` 或 `findManifestRoot` 失败 → `throw` | L227–229、L257 |
| 下载分支任意 catch | `console.warn('[stage] semantic download failed', error)` 后 **`if (requireSemanticRuntimeComplete) throw error`** | L300–307（`75e9ebe` 新增 L307） |

当 `requireSemanticRuntimeComplete` 为真且下载失败时，**不会**执行 catch 之后的 `FDE_SEMANTIC_RUNTIME_SRC` / vendor / `writeStubSemantic()`（L311–351），与 DSH 在 CI 下 npm 失败后 `throw`（L136–138）对称。

DSH 对照：`process.env.CI === 'true'` → `throw`（L138）；semantic 用更宽的 `requireSemanticRuntimeComplete`（含显式 `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1` 的非 CI 场景），满足审查项且不误伤纯本地默认。

### verify.mjs — 同上标志 + incomplete → exit 1

```39:47:scripts/pack/verify.mjs
  if (!versions.semanticRuntime?.complete) {
    if (requireSemanticRuntimeComplete) {
      console.error(
        'verify failed — semantic runtime incomplete (required when CI=true or FDE_DOWNLOAD_SEMANTIC_RUNTIME=1)',
      )
      process.exit(1)
    }
    console.warn('verify: semantic runtime is stub/incomplete')
  }
```

- **硬失败分支**：`!complete` 且 `requireSemanticRuntimeComplete` → `console.error` + **`process.exit(1)`**（L40–44）。
- **warn 分支**：`!complete` 且非 require → **`console.warn('verify: semantic runtime is stub/incomplete')`**（L46），进程继续（DSH 仍可在 L49–52 单独失败）。

### 本地无 `CI` / 无 `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1`

| 组件 | 行为 |
|------|------|
| `stageSemantic` 下载失败 | L306 warn；L307 不 throw → 可回落 src/vendor/既有树/`writeStubSemantic()`（L311–351） |
| `verify` incomplete | 仅 L46 warn，**不** exit 1 |

与 `wave5-09-semantic-ci-hardfail.md` 表中「本地 DEV 行为不变」一致（实现者已用临时 `FDE_PACK_OUT` + `versions.json` 测过 `CI=true` exit 1；本 spot-check 未重跑）。

## 仍差 / 未验（不推翻「合并保留」）

1. **非下载路径的 semantic stage 失败**（`semantic copy failed`，L328–330）在 `CI=true` 且 `FDE_DOWNLOAD_SEMANTIC_RUNTIME=0`（跳过下载）时仍只 warn，可能 `writeStubSemantic()`；但 `verify` 在 `requireSemanticRuntimeComplete` 下仍会 **exit 1**。与「下一刀」原文（仅要求下载失败与 DSH 对称）一致；非 GHA 默认 env。
2. **完整 `stage.mjs` 下载 + GHA 绿跑** — 未在本审查重跑（与 pack-copy-review gap #3 同类「未对」）。
3. **NOTICE.md POC** — 本提交未动；仍属 spec §6 后续，非本刀范围。

## 与母体审查衔接

| 项 | `wave5-09-pack-copy-review` | `75e9ebe` 后 |
|----|----------------------------|--------------|
| CI semantic 下载失败 silent stub | **仍差**（L302–304 warn + stub；verify 仅 warn） | stage **throw**；verify **exit 1** |
| 整体 pack 裁决 | 需小修（缺一刀） | 本刀已落；**建议 main 在含 `75e9ebe` 后对该 gap 标为已对（代码接点）** |

## 结论摘要

- **提交**：`75e9ebe79da1e774aad970e8c150bc36b09927b1`
- **fail**：`stage.mjs` L307 `throw`；`verify.mjs` L40–44 `exit 1`
- **warn**：`stage.mjs` L306（下载失败且非 require）；`verify.mjs` L46（incomplete 且非 require）
- **裁决**：**合并保留**
