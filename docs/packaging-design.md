# FDE-X 工作台 · 单一安装包与跨平台方案（2026-09-16）

需求（Ace）：最终交付**一个安装包**，用户只装它；DSH、semantic-os runtime、lan-assist 全部内置；macOS / Linux / Windows 通用。
本篇基于对源码、官方 DSH 包、semantic-os runtime 的只读调研（`internal/research-packaging.md`），给出诚实的可行性判断和路线。

---

## 1. 结论先行

- **可以做成「用户只装一个包」**，但不是「一个文件通吃三 OS」——是**每个平台 × 架构各一个安装包**（mac arm64 / mac x64 / win x64 / linux x64，按需再加 arm64）。这是所有带原生二进制的桌面软件的常态。
- **体积约 2.2–2.5 GB / 平台**，其中 semantic-os 的 Python 运行时占 1.8 GB（torch 一家就 ~500 MB）。这是不可回避的代价，除非把语义能力做成可选组件。
- **难度排序：macOS（当前唯一验证过的平台）< Linux < Windows。** Windows 有一串已知阻塞点（见 §3），全部可解，但要投入。
- **推荐架构：Electron（内置 Node 22）+ 资源目录内置 DSH npm 树 + lan-assist + semantic runtime-dist，按平台分包。** 理由：现在的架构就是「Node 多进程 + Python sidecar」，Electron 改动最小；Tauri 的壳体积优势（15 MB vs 150 MB）在 2.3 GB 总包面前毫无意义，却要引入 Rust sidecar 编排；纯在线下载不满足「只装一个包」。

---

## 2. 现状依赖盘点（要打进包里的东西）

| 组件 | 形态 | 体积 | 原生/平台相关 | 现在怎么找到它 |
|---|---|---|---|---|
| FDE-X 壳 + BFF | Node ≥ 22（`node:sqlite`、`node:zlib` zstd） | ~10 MB 源码 + 前端构建产物 | 无原生 npm 模块 | — |
| DSH | 全局 npm `@deepseek-ai/dsh@0.1.5-rc.1` | ~280 MB | `sharp`、`koffi`、`@vscode/ripgrep` 预编译二进制 | 硬编码 `/opt/homebrew/bin/dsh` → `/usr/local/bin/dsh` → PATH |
| lan-assist | vendor 目录，Node ≥ 20，MIT | ~50 MB（含 office 解析库） | 无 | `~/.dsh/vendor/dsh-lan-assist` symlink 进 profile |
| semantic-os runtime | 嵌入式 CPython 3.12 + faiss / onnxruntime / torch / sklearn / FalkorDBLite | **1.8 GB** | 全部平台相关 wheel | 从 `~/.dsh/semantic-os/runtime` 或 `vendor/.../runtime-dist/<platform-arch>` **全量拷贝**到 `DSH_HOME/semantic-os/runtime` |
| 用户数据 | `~/.dsh-fde-x`（会话、存储、profile）、`runtime/data/*.sqlite` | 增长 | — | `homedir()` 默认 |

好消息：FalkorDB 走 `falkordblite` 嵌入式，**不需要 Redis 或 Docker**；FDE 自身没有 better-sqlite3 之类要编译的模块；所有端口都能改成动态或 env 配置。

许可证：DSH、lan-assist、semantic-os 均 MIT；semantic runtime 自带 `LICENSES/python-distributions.json`（faiss、FalkorDB 等）。随包分发需要生成完整 NOTICE 文件，torch / transformers / onnx 一并列入；FalkorDB 家族建议法务复核一次。

---

## 3. 三平台阻塞点

| 阻塞 | 位置 | 影响平台 | 解法 |
|---|---|---|---|
| `pgrep` / `lsof` 做进程回收 | `dsh-core.mjs` L16、L27 | Windows | 换成 Node 自管子进程句柄 + 端口探测（`net` 模块），或 `find-process` 类跨平台库 |
| `PATH.split(':')` | `dsh-core.mjs` L50 | Windows | `path.delimiter` |
| profile 里 `fde-x-dsh-bridge` 用 **symlink** | `dsh-core.mjs` L350 | Windows（需开发者模式） | 改为 junction 或直接拷贝 |
| `osascript` 选目录 | `server.mjs` L34 | Linux / Windows | Electron `dialog.showOpenDialog` 替代 |
| zstd 依赖 Node 22 内置 zlib | `server.mjs` L9–13 | 全部 | 固定 bundled Node 22，不依赖系统 Node |
| semantic runtime 每平台一份 wheel | `runtime-dist/<platform-arch>` | 全部 | CI 按平台构建 runtime-dist；Windows arm64 可先不支持 |
| 语义路径要求 ASCII cwd | `dsh-core.mjs` L115–118 | 全部（中文用户名 / 路径） | 已有「中文 cwd 剥 x-dsh-cwd」策略；Windows 用户目录常含中文，要在安装时把 `DSH_HOME` 放到 ASCII 路径（如 `%LOCALAPPDATA%\FDE-X`） |
| `process.exit(0)` + 监督重启 | `server.mjs` L16–29、`dev.mjs` L78–90 | Windows 信号语义 | Electron 主进程直接管理 BFF 子进程生命周期，不再依赖 shell 监督脚本 |
| glibc / musl | Python runtime 构建目标 | Linux | 只支持 glibc 主流发行版（Ubuntu 22.04+ / Fedora / Debian 12+），AppImage 或 deb + rpm |
| 硬编码 homebrew 路径、`~/.dsh`、端口 | 见调研 §5 表 | 全部 | 引入 `FDE_APP_ROOT` / `FDE_RESOURCES`，所有默认值从它派生 |

---

## 4. 目标架构

```
<安装目录>/
  FDE-X(.app / .exe / AppImage)      Electron 主进程：窗口、生命周期、进程管理、系统对话框
  resources/
    node/                            bundled Node 22（或直接用 Electron 内置 Node 跑 BFF）
    app/                             FDE-X 前端构建产物 + runtime/*.mjs（BFF）
    dsh/                             @deepseek-ai/dsh npm 树（含 sharp/koffi/ripgrep 平台二进制）
    plugins/dsh-lan-assist/
    plugins/dsh-semantic-os/
    semantic-runtime/<platform-arch>/   1.8 GB Python 运行时（首次启动拷到用户目录，或就地使用）
    LICENSES/ NOTICE
<用户数据目录>（ASCII 路径）
  dsh-home/                          = 现在的 ~/.dsh-fde-x（会话、profile、semantic cache）
  data/fde-workstation.sqlite
```

运行时链路不变：Electron → 拉起 BFF（`runtime/server.mjs`，loopback 动态端口）→ BFF 拉起 DSH（`--profile --patch --port 0`）→ DSH 装 lan-assist / semantic-os / fde-x-dsh-bridge。前端静态资源由 BFF 直接服务（去掉 Vite dev 代理层），Electron 窗口打开 `http://127.0.0.1:<port>`。

**semantic runtime「拷贝」问题**：现在的逻辑会把 1.8 GB 从源拷到 `DSH_HOME/semantic-os/runtime`，安装后等于占两份。生产包应让 `installer.ensure()` 直接指向 `resources/semantic-runtime`（只读）+ 可写 cache 在用户目录。这需要改 `dsh-core.mjs` L384–441 的「必须自有拷贝」策略。

**可选组件**：在安装器里把「语义记忆」做成可勾选组件（默认勾选）。不勾则包体从 2.3 GB 降到 ~500 MB，记忆模块显示「未安装语义引擎」。企业分发可以两种包都出。

---

## 5. 路线

| 阶段 | 内容 | 产出 |
|---|---|---|
| **P0 去硬编码**（1 周，可与平台方案阶段 0 并行） | `FDE_APP_ROOT` / `FDE_RESOURCES` / `FDE_DSH_BIN` / `FDE_DSH_HOME` 全部走配置；`pgrep`/`lsof`/`PATH` 分隔符/symlink 换跨平台实现；BFF 服务静态前端 | 现有 `pnpm dev` 行为不变，但所有路径可注入 |
| **P1 macOS arm64 POC**（2 周） | Electron 壳；打包脚本把 DSH npm 树、两个插件、runtime-dist 放进 resources；首次启动初始化用户目录；DMG；签名 + notarize | 一个能在干净 Mac 上双击运行的 DMG |
| **P2 Linux x64**（1–2 周） | AppImage + deb；CI 构建 linux runtime-dist；验证 glibc 目标 | 干净 Ubuntu 22.04 可运行 |
| **P3 Windows x64**（2–3 周） | 修 §3 全部 Windows 项；win runtime-dist；NSIS 安装器；ASCII 用户目录；代码签名 | 干净 Win 11 可运行 |
| **P4 体验** | 自动更新（electron-updater，分组件更新 semantic runtime 避免每次 2 GB）、可选组件、崩溃日志 | — |

CI：每平台一条流水线，产物 4 个安装包 + NOTICE。runtime-dist 由 semantic-os 官方按平台发布最好；若官方只出 darwin-arm64，我们要自己在 CI 上 `pip download` 对应平台 wheel 组装——这是 Linux / Windows 阶段最大的不确定项，P0 时就应先确认官方是否提供。

---

## 6. 已拍板（2026-09-16，Ace）

1. 接受每平台一个安装包。
2. 接受 ~2.3 GB。
3. 用户主要在 **mac 和 Windows** → 平台顺序改为 **mac → Windows → Linux**；§5 的 P2/P3 对调。
4. Electron 作壳。
5. 去硬编码并入阶段 0，已开工。
6. 策略：先把功能做好，再仿照 semantic-os 官方「GitHub 打包一键安装（插件 + Semantica runtime）」的做法在 GitHub Actions 上出包。

## 7. semantic-os 官方安装包核实结果（2026-09-16）

仓库 [losebird/dsh-semantic-os](https://github.com/losebird/dsh-semantic-os)，[v0.1.1 Release](https://github.com/losebird/dsh-semantic-os/releases/tag/v0.1.1)。

**可以直接照搬的**
- CI：`.github/workflows/runtime-packages.yml`，matrix 覆盖 macos-14 / macos-13 / ubuntu-24.04 / ubuntu-24.04-arm / windows-2022；`uv` 装可搬迁 CPython 3.12.10；wheelhouse 离线 pip；treeHash manifest；`verify-runtime-relocation`。
- Release 资产**已有 win32-x64（466 MB 压缩）**、darwin-arm64（455 MB）、linux-x64 / arm64；缺 darwin-x64（matrix 里有，没挂）。→ 「Windows runtime 要不要自己组装」这个不确定项**消除**。
- installer 模块：staging → 校验 → rename → 失败回滚；`current.json` / `install-state.json` 版本语义；升级时整包替换。

**要改的**
- 官方包形态是 `tar.gz` + 双击脚本，且**依赖用户已装 DSH 和 pnpm**——不符合「只装一个包」。FDE-X 的 Electron 安装器要把 DSH npm 树和 Node 一起带上，把 `install-release.js` 的编排逻辑移到首次启动。
- 官方 **未签名未公证**；mac 分发要补 codesign + notarize，Windows 要补 Authenticode，否则用户会被系统拦。
- DSH 官方（deepseek-harness）没有任何二进制安装器，只有 npm——所以 DSH 这一层只能我们自己打进 resources。

**Windows 的一个硬限制**
- `falkordblite`（嵌入式图数据库）在 Windows **被 requirements 明确排除**；官方在 Windows 上让图存储走 Docker / WSL / 文件备份（`ensure-deps.js` L446–450、L107–110）。这意味着 Windows 单包里**记忆模块的图能力**要么降级为文件模式，要么要求用户装 WSL/Docker。向量（faiss）和 onnx 不受影响。→ 需要在 Windows 阶段决定：接受图能力文件模式降级（推荐），还是等 falkordblite 出 Windows 轮子。

**修订后的路线**
- P0 去硬编码（进行中）→ P1 mac arm64 Electron POC（复用官方 runtime-dist 资产，加签名公证）→ P2 **Windows x64**（复用官方 win32-x64 资产 + 图存储文件模式 + Authenticode + §3 阻塞点）→ P3 Linux → P4 自动更新（分组件更新 runtime）。

## 8. P1 代码落地（2026-09-17）

Ace 决策：CI 必须打真 `@deepseek-ai/dsh` npm 树；P1 坚持 1.8GB 首启拷贝（官方 `runtime-install.js`），打包默认不是 readonly。

已进 main：`d0cf3a9`（首启拷贝）· `84fb4cf` / `6a72f79`（真 dsh + desktop CI）· `75e9ebe`（CI semantic 失败硬失败）。抽检合并保留。

未跑：GitHub Actions 绿跑、干净机全量 1.8GB、DMG / 公证。P2 未开。
