# Runtime 环境变量

FDE-X 本地 BFF（`runtime/server.mjs`）与 DSH 核心连接器从 `runtime/config.mjs` 读取默认值。开发时 `scripts/dev.mjs` / `dev-peer.mjs` 会注入部分变量；Electron 单包分发时应由主进程在启动子进程前设置。

| 变量 | 含义 | 默认 |
|------|------|------|
| `FDE_APP_ROOT` | 应用根目录（仓库或 asar 解包根） | `runtime/..` |
| `FDE_RESOURCES` | 捆绑资源根（含 `dsh/bin`） | 同 `FDE_APP_ROOT` |
| `FDE_DSH_BIN` | `dsh` 可执行文件 | 包内 `$FDE_RESOURCES/dsh/bin/dsh` → `/opt/homebrew`/`/usr/local` → PATH |
| `FDE_DSH_HOME` | 隔离 DSH 状态目录 | `~/.dsh-fde-x` |
| `FDE_VENDOR_DIR` | 官方插件 vendor 源 | `~/.dsh/vendor` |
| `FDE_DSH_PATCH` | 核心 patch 文件 | `runtime/dsh-core.patch.yml` |
| `FDE_SEMANTIC_RUNTIME_SRC` | 语义 OS runtime 探测根（覆盖默认） | 仓库内 `runtime/data/semantic-os/runtime`（存在时）；否则 `~/.dsh/semantic-os/runtime` |
| `FDE_AI_WORKSPACE` | AI 默认工作区 cwd | 进程 `process.cwd()`（与 DSH 一致） |
| `FDE_RUNTIME_HOST` | BFF 监听地址 | `127.0.0.1` |
| `FDE_RUNTIME_PORT` | BFF 端口 | `4318` |
| `FDE_WEB_PORT` | 开发 UI 端口（提示文案） | `5174` |
| `FDE_DATABASE_PATH` | SQLite 路径 | `runtime/data/fde-workstation.sqlite` |
| `FDE_ALLOWED_ORIGINS` | CORS 白名单（逗号分隔） | 本机 4173/5173/5174/5175 + 4318/4319 |
| `FDE_STATIC_DIR` | 生产静态前端根（`dist/`）；设置后 BFF 提供 SPA | 未设置（开发仍走 Vite） |
| `FDE_SEMANTIC_RUNTIME_MODE` | `readonly` 时跳过装配拷贝，直接用探测到的 runtime 根 | `copy`（默认：从仓库或探测源拷到 `~/.dsh-fde-x/semantic-os/runtime`） |
| `DSH_LAN_ASSIST_PORT` | IM 门牌 LAN 端口 | `19527` |
| `FDE_RUNTIME_SUPERVISED` | `1` 时退出由 dev 脚本拉起 | 未设置 |
| `FDE_RUNTIME_URL` / `VITE_FDE_RUNTIME_URL` | 前端直连 BFF（iframe） | `http://127.0.0.1:4318` |

对端开发：`FDE_PEER_RUNTIME_PORT`（4319）、`FDE_PEER_WEB_PORT`（5175）、`FDE_PEER_LAN_PORT`（18528）、`FDE_PEER_DSH_HOME`（`~/.dsh-fde-peer`）。

## Electron 打包预期

- `FDE_APP_ROOT` / `FDE_RESOURCES`：指向 `resources` 或 `app.asar.unpacked`。
- `FDE_DSH_BIN`：指向包内 `dsh`（Windows 为 `dsh.cmd`），不要依赖 Homebrew。
- `FDE_DSH_HOME`：用户数据目录，例如 `%APPDATA%/fde-x/dsh` 或 `~/Library/Application Support/fde-x/dsh`。
- `FDE_VENDOR_DIR`：可随包分发或首次启动从官方同步到用户目录。
- `FDE_ALLOWED_ORIGINS`：仅允许 `file://` 不适用；应包含实际加载 UI 的 origin（例如自定义 protocol 或 `http://127.0.0.1:<ui-port>`）。
- 目录选择：非 macOS 无 `osascript`；由 Electron 主进程实现选择器并通过 API 传入路径，或禁用「选文件夹」直至集成。

DSH 子进程 pid 记录在 `$FDE_DSH_HOME/run/*.pid`，用于跨平台清理残留核心，不再依赖 `pgrep` / `lsof`。
