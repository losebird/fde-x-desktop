---
cursor:
  subagentId: "bc-209d252f-ea8c-50f2-95d0-8bb4a7845a97"
---

# 小白一键启动（simple start）

**仓库：** `losebird/fde-x-desktop`  
**提交：** `8f028d8` — `feat: one-command npm start for beginners`

## 用户怎么做

1. 安装 Node.js（带 `npm`）。
2. 安装 DSH，终端能跑 `dsh`。记忆/语义在 DSH 首启时同步到 `~/.dsh-fde-x`，不把 1.8G vendor 进 git。
3. 进入项目目录：`npm i`
4. 启动（任选其一）：
   - **`npm start`** — 拉起 4318（BFF + DSH 监督）和 5174（Vite UI），无需环境变量。
   - **`start.command`**（macOS 双击）— `cd` 到脚本所在目录后执行 `npm start`。

默认浏览器地址：`http://127.0.0.1:5174`。

第二套本机：`npm run dev:peer`（5175 / 4319）。

## 实现要点

| 项 | 说明 |
|----|------|
| `package.json` | `"start": "node scripts/dev.mjs"`（与 `dev` 相同） |
| `runtime/config.mjs` | 未设 `FDE_AI_WORKSPACE` 时用 `process.cwd()`，与 DSH 一致；`FDE_DSH_BIN` 等仍可按环境变量覆盖 |
| `scripts/dev.mjs` | 未改：自动找 `dsh`、准备 `~/.dsh-fde-x`、4318 监督重启、5174 Vite |
| `start.command` | 可执行 shell，`dirname $0` 定位项目根 |

## 不再要求

- 双终端 `npm run runtime` + `npm run dev`
- README 里的 `FDE_DSH_BIN` / `FDE_AI_WORKSPACE="$PWD"` 起手式
- 「必须绝对路径工作区」
