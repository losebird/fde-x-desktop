# Platform runtime packages

正式发布由 CI 为以下目标生成独立 npm optional package：

- `darwin-arm64`
- `darwin-x64`
- `linux-arm64`
- `linux-x64`
- `win32-x64`

每个包必须包含 `runtime-manifest.json`、已预装依赖的可再分发 Python runtime、`constraints.txt`、实际解析后的 `resolved-requirements.txt`、`LICENSES/`，并在 manifest 的 `files` 中记录每个文件的 SHA-256。wheelhouse 只存在于 CI 构建阶段，验证和安装结束后删除，避免把同一依赖以 wheel 与 site-packages 重复发布。主插件只安装与当前 OS/CPU 匹配的 optional dependency。

运行时构建必须在对应原生 CI runner 上完成，不能交叉复制 FAISS/OpenMP 等本地二进制。默认运行不访问 PyPI；设置 `DSH_SEMANTIC_OS_OFFLINE=1` 可强制缺包时失败。在线安装仅作为开发或修复回退。
