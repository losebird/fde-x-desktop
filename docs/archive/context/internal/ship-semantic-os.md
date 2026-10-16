---
cursor:
  subagentId: "bc-ec6d9089-0cc7-54b6-ac91-1942a50786c6"
---

# semantic-os 上船交付

## 1. 本地源数据

| 项 | 值 |
|----|-----|
| 拷贝来源 | `/Users/zxz/.dsh-fde-x/semantic-os/runtime` |
| 仓库内路径 | `runtime/data/semantic-os/runtime/` |
| 整树体积 | **1.8G**（`du -sh`） |
| 文件数 | **48,058** |
| 最大单文件 | **337,911,904 B（≈322 MiB）** — `0.1.1/darwin-arm64/python/lib/python3.12/site-packages/torch/lib/libtorch_cpu.dylib` |
| 次大（>100MB，走 LFS） | **129,480,000 B（≈123 MiB）** — `.../llvmlite/binding/libllvmlite.dylib` |
| 平台键 | `0.1.1` / `darwin-arm64`（与 Ace 本机一致） |

## 2. 上船方式

**主路径：进 git（已推送），未走 Release 退路。**

- 从 `.gitignore` 移除 `runtime/data/semantic-os/`，将完整 runtime 树提交到上述路径。
- **Git LFS**（`brew install git-lfs` + `git lfs install`）跟踪两个 >100MB 的 dylib；其余 ~1.3GB 为普通 git 对象。
- 首次 HTTPS push 遇 `CONNECT tunnel failed, response 503`；约 16 分钟后重试成功（LFS 467MB + 大包 push 总耗时 ~15min）。

退路（Release 自动下载）：**未启用** — GitHub 接受了整树 + LFS，无拒绝记录。

## 3. GitHub 证据

| 项 | 链接 / SHA |
|----|------------|
| **commit** | [`1f8c05312faf222432ee43308a95c598c04c9d35`](https://github.com/losebird/fde-x-desktop/commit/1f8c05312faf222432ee43308a95c598c04c9d35)（`main`，父提交 `8f028d85`） |
| **目录** | [runtime/data/semantic-os/runtime](https://github.com/losebird/fde-x-desktop/tree/main/runtime/data/semantic-os/runtime) |
| **`current.json` on GitHub** | API 可读，内容与本地一致（`runtimeVersion` `0.1.1`，`key` `darwin-arm64`） |
| **LFS** | `.gitattributes` 中 2 条 track；push 日志 `Uploading LFS objects: 100% (2/2), 467 MB` |

## 4. 小白步骤（clone 后）

1. 安装 **Node.js**（带 `npm`）。
2. 安装 **DSH**，终端能执行 `dsh`（AI/插件 Host 仍需要；**不再**要求本机 `~/.dsh` 里已有 1.8G semantic runtime）。
3. `git clone https://github.com/losebird/fde-x-desktop.git`（需 **Git LFS**：`git lfs install` 后 clone，或 clone 后 `git lfs pull`）。
4. `cd fde-x-desktop && npm i && npm start`。
5. 浏览器打开 `http://127.0.0.1:5174`。

`npm start` 会通过 `runtime/config.mjs` 优先使用仓库内 `runtime/data/semantic-os/runtime`，`dsh-core.mjs` 再装配到 `~/.dsh-fde-x/semantic-os/runtime`（默认 `copy` 模式）。无需设置 `FDE_SEMANTIC_RUNTIME_SRC` / `FDE_VENDOR_DIR` 仅为语义数据。

**说明：** 当前提交内嵌的是 **darwin-arm64** runtime；其它 OS/arch 仍需自备 runtime 或后续补矩阵（本次任务按 Ace 本机数据交付）。

## 5. 改动文件与进程

**代码/配置（非 48k 数据文件）：**

- `.gitignore` — 放行 `runtime/data/semantic-os/`
- `.gitattributes` — LFS 跟踪两个 dylib
- `runtime/config.mjs` — `bundledSemanticRuntimeRoot()`；`officialSemanticRuntimeRoot()` 默认优先仓库内树
- `README.md` — 去掉「从 DSH 同步 1.8G / 不要进 git」
- `docs/RUNTIME-CONFIG.md` — 更新 `FDE_SEMANTIC_RUNTIME_SRC` / `MODE` 说明

**数据：** `runtime/data/semantic-os/runtime/**`（48,058 文件）

**未动：** 5174 / 4318 端口与正在跑的进程；未 reload 核心。

**仓库 / 分支：** `losebird/fde-x-desktop` · `main`（直接提交推送，无交付用 feature 分支）。
