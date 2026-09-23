# FDE-X Desktop

本机工作台。浏览器只打自己的 API；AI / IM / 记忆分别由 DSH、lan-assist、semantic-os 在本机提供。

## 准备

1. 安装 [Node.js](https://nodejs.org/)（建议当前 LTS，需带 `npm`）。
2. 安装 **DSH（DeepSeek Harness）**，保证终端里能执行 `dsh`（例如 Homebrew 或官方安装方式）。  
   记忆与语义引擎在 **DSH 首次启动** 时会从本机已有 DSH 目录同步到工作台专用目录（`~/.dsh-fde-x`），**不要把约 1.8G 的 vendor 树放进 git**。

## 启动

在项目目录安装依赖后，一条命令拉起本地核心（4318）和界面（5174）：

```bash
npm i
npm start
```

浏览器打开终端里提示的地址（默认 `http://127.0.0.1:5174`）。Vite 只把 `/api/v1` 和 `/health` 转到 4318。

macOS 也可双击项目根目录的 `start.command`（从脚本所在目录启动，效果同 `npm start`）。

高级用法（可选）：仍可通过环境变量覆盖，例如 `FDE_AI_WORKSPACE`（AI 默认工作区）、`FDE_DSH_BIN`（`dsh` 可执行文件路径）。未设置时，工作区与 DSH 一致，使用**当前进程的当前工作目录**。

第二套本机实例（对端 IM 联调）：`npm run dev:peer`（5175 / 4319）。

## 权威

| 能力 | 引擎 |
|---|---|
| 会话、模型、工具、轨迹 | DSH Host |
| IM、业务过账 | dsh-lan-assist |
| 记忆搜索 | dsh-semantic-os |
| 待办/布局 | 本机 SQLite + 浏览器壳状态 |

不要用浏览器打开 DSH 官方网页当产品界面。接线规格见 `PRODUCTION-SPEC.md`（冲突以 §0.5 为准）。
