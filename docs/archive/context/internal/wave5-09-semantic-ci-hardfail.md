---
cursor:
  subagentId: "bc-65069f4a-dcf7-57ac-987e-fe9b05766bca"
---

# Wave 5 · Semantic runtime CI hard-fail

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**依据**：`internal/wave5-09-pack-copy-review.md` gap #1 · spec 09 §6

## 改动

| 文件 | 变更 |
|------|------|
| `scripts/pack/stage.mjs` | 新增 `requireSemanticRuntimeComplete`（`CI===true` 或 `FDE_DOWNLOAD_SEMANTIC_RUNTIME===1`）。`shouldDownloadSemantic` 分支内 `downloadSemanticRuntime` 失败时：先 `warn`，若 `requireSemanticRuntimeComplete` 则 `throw`（与 DSH L133–136 对称），不再回落 stub/本地拷贝。 |
| `scripts/pack/verify.mjs` | 同上标志；`semanticRuntime.complete` 非 true 时 `exit 1` + `console.error`，否则仍 `warn`。 |
| `.github/workflows/desktop.yml` | **未改**（已设 `FDE_DOWNLOAD_SEMANTIC_RUNTIME: '1'`；GHA 自带 `CI=true`）。 |

**未动**：`NOTICE.md` 生成、`apps/desktop/src/*`、first-run / desktop runtime、DMG / 签名。

## 验证

| 检查 | 结果 |
|------|------|
| `node --check scripts/pack/stage.mjs` | 0 |
| `node --check scripts/pack/verify.mjs` | 0 |
| 临时 `FDE_PACK_OUT` + `versions.json`（`semanticRuntime.complete: false`，dsh staged） | `CI=true` → verify **exit 1**；无 CI → **exit 0** + warn |

未跑完整 `stage.mjs` 下载（避免动 repo `resources/` 与大包下载）。

## 提交

```
fix(pack): fail CI when semantic runtime stage is incomplete
```

仅 `git add scripts/pack/stage.mjs scripts/pack/verify.mjs`（非 `git add -A`）。本地 `main` 已提交；未 push（worker 未授权）。

## 对照（审查缺口）

| 项 | 前 | 后 |
|----|----|-----|
| CI semantic 下载失败 | warn → stub，`verify` 仅 warn | stage **throw**；verify **exit 1** |
| 本地 DEV（无 `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1`、非 CI） | stub 可接受 | 行为不变（warn） |
