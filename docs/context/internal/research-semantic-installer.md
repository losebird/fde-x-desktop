# dsh-semantic-os 一键安装包调研（只读）

**仓库**：https://github.com/losebird/dsh-semantic-os · **Release**：https://github.com/losebird/dsh-semantic-os/releases/tag/v0.1.1
**本机 vendor**：`/Users/zxz/.dsh/vendor/dsh-semantic-os/` · **本机 runtime**：`~/.dsh/semantic-os/`（实测 `darwin-arm64` 展开 **1.8G**）

## 1. 安装包形态与装了什么、装到哪
- **形态**：各平台 **`*.tar.gz` + `.sha256`**，解压后为目录（非 dmg/pkg/msi）。入口：macOS `Install Semantic OS.command` → `node scripts/install-release.js`；Windows `Install Semantic OS.cmd`；Linux `install-semantic-os.sh`。
- **离线介质** = `npm pack` 主插件 `.tgz` + 整棵 `runtime/` + `runtime-install.js` / `runtime-bundle.js` / `install-release.js`（`scripts/build-release-media.js` L16–32、L40）。
- **内容**：插件 0.1.1 + 预装 Python 3.12.10（uv）+ `semantica[explorer]`（源码/本机 0.6.7；Release 文案写 0.6.5）。
- **落盘**：Runtime `${DSH_HOME:-~/.dsh}/semantic-os/runtime/<runtimeVersion>/<platform-arch>/`；指针 `runtime/current.json`；健康 `install-state.json`；插件 `dsh plugin --profile web add <tgz>` → `~/.dsh/vendor/dsh-semantic-os`。
- **依赖**：需已装 DSH 与 pnpm（`install-release.js` L38–42）；无管理员、不访问 PyPI。

## 2. GitHub Releases `platform-arch` 与体积
| 资产 | ≈压缩体积 | v0.1.1 |
|------|-----------|--------|
| darwin-arm64 | 455 MB | 是 |
| win32-x64 | 466 MB | 是 |
| linux-x64 | 754 MB | 是 |
| linux-arm64 | 652 MB | 是 |
| darwin-x64 | — | **否**（CI matrix 有） |

## 3. 构建方式
- `.github/workflows/runtime-packages.yml`；触发 `workflow_dispatch` / tag `runtime-v*`。
- Matrix：macos-14 / macos-13 / ubuntu-24.04 / ubuntu-24.04-arm / windows-2022；`fail-fast: false`。
- Python：`uv python install 3.12.10` 到 `runtime-dist/<target>/python`（可搬迁 CPython）。
- 依赖：`download-wheelhouse.js` + `pip install --no-index --find-links wheelhouse`；`constraints.txt`（Linux `torch==2.13.0+cpu`）。
- 收尾：`finalize-runtime-package.js`（resolved-requirements、树哈希 manifest v2）→ `verify-runtime-relocation.js` → `build-release-media.js` → `gh release upload`。
- **未签名 / 未公证**（workflow 无 codesign 步骤）。

## 4. 首次拷贝与升级
- 一键安装：`installRuntimeFromDirectory` 递归 cp 到 `runtime/<ver>/<key>/`（staging → treeHash 校验 → rename；失败回滚）。
- 首次启动 DSH：已装 runtime 则不 pip，只 probe。
- 升级：`plugin remove` 再 `add`；runtime 整包替换并更新 `current.json`；激活失败保留旧 runtime。

## 5. FDE-X 启示
- 可复用：CI matrix + stage/build/finalize 脚本模式；`runtime-manifest.json` + treeHash；`installer.js` 锁与进度；`install-release.js` 编排思路。
- 需自建：Electron 壳、插件加载树、lan-assist、BFF；安装入口改为 FDE-X profile/路径。
- **Windows 官方限制**：`requirements.txt` L5 **`falkordblite` 排除 Windows**；`ensure-deps.js` L446–450、L107–110：原生无嵌入式图库 → Docker / WSL / 文件图备份。
- Issues：无公开 windows/falkordblite 命中。

## 6. 自研 Windows runtime 可行性
- 官方已有 win32-x64 资产 → 矩阵可绿；`faiss-cpu`、`onnxruntime`、`torch` 均有 win_amd64 轮子。
- `falkordblite` 故意不装；Windows 图存储走 Docker/WSL/文件，不能指望单包。
- 风险：Long Path、杀毒扫描大目录拷贝、无 OpenMP 路径差异。

## 7. deepseek-harness 官方分发
- Releases 无独立安装器资产；安装为 `npx @deepseek-ai/dsh web` / npm 全局。
