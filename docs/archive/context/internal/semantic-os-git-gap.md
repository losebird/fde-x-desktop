---
cursor:
  subagentId: "bc-0d47db88-defe-58de-b4df-05b9e38211a8"
---

# semantic-os 与 Git / `runtime/` 缺口核查

**仓库：** `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**远端：** `origin/main`（与本地一致，`git ls-tree origin/main runtime/` 无 `semantic-os`）  
**结论（给 Ace）：** GitHub 上 `runtime/` 没有 `semantic-os` **不是漏提交**，而是产品设计：语义引擎体积约 **1.8GB+**，放在本机 DSH 家目录，由首启/打包流程装配；仓库只保留代理与装配代码。

## 1. 本地 `runtime/` 下有没有 `semantic-os`？

| 路径 | 存在？ | 约略体积 | 说明 |
|------|--------|----------|------|
| `runtime/semantic-os/` | **否** | — | 代码里从未把语义树放在仓库 `runtime/` 下 |
| `runtime/data/semantic-os/` | **否**（目录不存在） | — | `.gitignore` 预留的本地数据位，当前未使用 |
| `runtime/vendor/` | **否** | — | 插件 vendor 不在仓库；默认 `~/.dsh/vendor` |
| `runtime/vendor/dsh-semantic-os/` | **否** | — | 同上 |
| `runtime/vendor-overlays/dsh-semantic-os/` | **否**（工作区无） | — | `origin/main` 仅有 `vendor-overlays/dsh-lan-assist/`；对象库里有未挂到 `main` 的孤儿 tree（`index.js`、`opening-brief.js`），**不算已发布内容** |
| `runtime/vendor-overlays/dsh-lan-assist/` | **是** | ~444K | 含 `semantic.js`（与 semantic-os HTTP 对话），**已进 git** |

`runtime/data/` 现有内容主要是 SQLite（~102M，其中 `fde-workstation.sqlite` ~94M），**无** semantic-os 子树。  
`runtime/memory/` 存在（~12K），与 semantic-os 图存储无关。

**本机实际语义相关大树（不在仓库 `runtime/` 下）：**

| 路径 | 约略体积 | 角色 |
|------|----------|------|
| `~/.dsh-fde-x/semantic-os/` | **~2.0G**（其中 `runtime/` **~1.8G**） | FDE 隔离家目录；`dsh-core.mjs` `ensureSharedSemanticRuntime()` 首启从官方/vendor **拷贝**到此 |
| `~/.dsh/semantic-os/` | **~3.9G** | 官方 DSH 语义安装（`FDE_SEMANTIC_RUNTIME_SRC` 默认探测根） |
| `~/.dsh/vendor/dsh-semantic-os/` | **~10G** | DSH 插件包 + `runtime-dist` 候选源 |
| `<repo>/.dsh/semantic-os/` | **~352K** | 当前工作区语义图（`graph.json` 等），工作区数据 |

## 2. `git check-ignore` 与 `.gitignore`

根目录 `.gitignore` 相关行：

```gitignore
runtime/data/semantic-os/
.dsh/
```

实测：

```text
.gitignore:5:runtime/data/semantic-os/    runtime/data/semantic-os/
.gitignore:5:runtime/data/semantic-os/    runtime/data/semantic-os/foo
.gitignore:6:.dsh/                        .dsh/semantic-os/graph.json
```

- **`runtime/semantic-os/`**：路径不存在；若创建且不在 ignore 规则内，**不会被**上述规则挡住（但产品也不使用该路径）。
- **`runtime/data/semantic-os/`**：**会被 ignore**（规则第 5 行）；即便有内容也不会进 git。
- **工作区图 ` .dsh/semantic-os/`**：整棵 `.dsh/` **会被 ignore**（第 6 行）。

打包产物：`resources/.gitignore` 为 `*`（仅保留 `.gitignore`），故 `resources/semantic-runtime/<platform>/`（`scripts/pack/stage.mjs` 写入）**也不会进 git**。

## 3. 首启拷贝 / 本机数据，还是漏提交？

| 类别 | 判定 |
|------|------|
| `runtime/semantic-os` 或 `runtime/vendor/dsh-semantic-os` | **不应进 git**；设计上从 `~/.dsh/vendor`、`~/.dsh/semantic-os/runtime` 或 GitHub release（`FDE_DOWNLOAD_SEMANTIC_RUNTIME` / CI）装配 |
| `~/.dsh-fde-x/semantic-os/runtime` | **首启拷贝的本机运行时**（默认 `FDE_SEMANTIC_RUNTIME_MODE=copy`），文档见 `HANDOFF-FDEX-WORKSTATION.md`、`PRODUCTION-STATUS.md`、`docs/RUNTIME-CONFIG.md` |
| `runtime/data/semantic-os/` | **可选本机数据位**（已 ignore）；当前机器上**没有**该目录，不是“删了没推” |
| `<repo>/.dsh/semantic-os/` | **本机工作区语义数据**（应 ignore，不进 git） |
| 仓库内与 semantic 相关的**已跟踪**内容 | 源码与装配：`runtime/dsh-core.mjs`、`runtime/config.mjs`、`runtime/server.mjs` 反代、`scripts/pack/stage.mjs` + `pins.mjs`、`apps/desktop/src/semantic-runtime.ts` 等；**无**二进制 runtime 树 |

`git ls-files` 在 `runtime/` 下与 semantic 直接相关的跟踪文件仅有 `runtime/vendor-overlays/dsh-lan-assist/semantic.js`（及同目录其它 lan-assist 文件）。  
`git log -- runtime/semantic-os runtime/data/semantic-os` 无历史提交（从未作为跟踪路径存在）。

## 4. 建议表述（该不该进 git）

- **不该进 git：** Python/semantica 运行时（~1.8GB）、官方 vendor 插件树（~10GB）、工作区 Falkor/图数据（`.dsh/semantic-os/`）、打包 staged 的 `resources/semantic-runtime/`。
- **已在 git / 应保持：** BFF 反代与 DSH 插件链接逻辑、`dsh-lan-assist` vendor overlay（含 `semantic.js`）、桌面首启拷贝与 `stage.mjs` 下载/拷贝语义 runtime 的流程。
- **若 Ace 期望在 GitHub 看到 `runtime/semantic-os`：** 与当前架构不符；应在文档或 README 中强调语义资源在 **`FDE_DSH_HOME`（默认 `~/.dsh-fde-x`）** 与 **`FDE_VENDOR_DIR`（默认 `~/.dsh/vendor`）**，而非仓库 `runtime/` 子目录。

## 5. 证据命令（本机 2026-09-23）

```bash
ls runtime/semantic-os runtime/data/semantic-os runtime/vendor  # 均不存在
du -sh ~/.dsh-fde-x/semantic-os ~/.dsh/semantic-os ~/.dsh/vendor/dsh-semantic-os
git ls-tree origin/main runtime/vendor-overlays/  # 仅 dsh-lan-assist
git check-ignore -v runtime/data/semantic-os/ .dsh/semantic-os/graph.json
```
