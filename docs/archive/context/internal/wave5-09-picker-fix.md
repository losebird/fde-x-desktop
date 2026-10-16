---
cursor:
  subagentId: "bc-71ff1f02-4a84-5c21-aecf-4f33830df488"
---

# Wave 5 · P1 must-fix 1 & 3

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**范围**：审查 `wave5-09-review.md` must-fix **#1**（前端 fdeDesktop）、**#3**（`FDE_ALLOWED_ORIGINS`）；未动 #2 stage/dsh、#4 §11 copy。

## 改动

| 提交 | 说明 |
|------|------|
| `1de8343` | `fix(web): use fdeDesktop picker in Electron` |
| `02cb78b` | `fix(desktop): allow app:// origin for BFF writes` |

```
 apps/desktop/src/main.ts |  1 +
 src/lib/runtime-api.ts   |  4 ++++
 src/vite-env.d.ts        | 10 ++++++++++
 3 files changed, 15 insertions(+)
```

### Must-fix 1

- `runtime-api.ts` `pickAiWorkspaceDirectory`：若 `window.fdeDesktop` 存在，直接 `pickDirectory()` 返回 `path`；**不调** `POST /api/v1/ai/workspaces/pick`（避免 osascript / 501）。
- `vite-env.d.ts`：声明 `FdeDesktopBridge` / `window.fdeDesktop`（与 `preload.ts` IPC 形状一致）。
- 浏览器 / `pnpm dev` 无 `fdeDesktop` → 原 BFF pick 路径不变。

### Must-fix 3

- `buildBffEnv` 增加 `FDE_ALLOWED_ORIGINS: 'app://fde-x'`（规格 §5 启动序列第 1 条）。
- Loopback `http://127.0.0.1:<port>` / `http://localhost:<port>` 仍由 `server.mjs` listen 后 `allowedOrigins.add`（L2595–2596）；与审查「listen 后补 loopback」一致。

## 验证

| 步骤 | 结果 |
|------|------|
| `npx tsc -b --pretty false`（两次提交后） | 退出 0 |
| `node runtime/smoke.mjs` | **未跑**（未改 `runtime/*.mjs`） |
| Electron 实机点「选择文件夹」 | **现网未测** |

## 对照（本任务触及项）

| 项 | 母体 | fdex | 状态 |
|----|------|------|------|
| §5.8 目录选择 | `x-fde-desktop: 1` → 501；前端 `fdeDesktop.pickDirectory` | 前端已接 `pickAiWorkspaceDirectory`；Electron 跳过 BFF pick | 已对（代码）；UI **现网未测** |
| §5.1 Origin | `app://fde-x` + loopback port | `buildBffEnv` 设 `app://fde-x`；listen 补 loopback port | 已对（代码）；custom protocol 加载 **现网未测** |

## 未做（按指派）

- must-fix #2 `stage.mjs` / `npm pack` dsh  
- must-fix #4 §11 1.8GB copy  
- `stage.mjs`、DMG、停 dev 栈

## 仍差 / 未对

- **仍差**：dsh 真树（#2）、§11 copy（#4）、P1 验收 1–7、Electron 绿条 walkthrough。  
- **未对**：干净机 DMG / 公证 / 60s ps（审查原表）。
