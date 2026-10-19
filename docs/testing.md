# 测试环境

`pnpm test:env` 跑 `scripts/setup-test-env.mjs`。`pnpm test:strict` 用 `--test-concurrency=1` 跑 `runtime/tests/*.test.mjs`。TAP 里任何一条 skip 都让进程退出 1。允许的 skip 理由写在 `scripts/test-env/skip-allow.json` 的 `reasons` 里。这份名单默认是空的。

插件提交钉在 `scripts/test-env/vendor-pins.json`。脚本核对检出的 `HEAD` 等于其中的 sha。来源按这个顺序取。

1. `FDE_PLUGIN_SOURCE_DSH_LAN_ASSIST` 或 `FDE_PLUGIN_SOURCE_DSH_SEMANTIC_OS`，指向 git bundle 或本地 git 目录。
2. `FDE_PLUGIN_SOURCES` 目录里的 `<dir>-<sha 前 8 位>.bundle`、`<dir>.bundle` 或 `<dir>/`。
3. `https://github.com/<repo>.git` 的该 sha。私有仓库用只读令牌 `FDE_PLUGIN_READ_TOKEN`。令牌只需要 `losebird/dsh-lan-assist` 和 `losebird/dsh-semantic-os` 的 Contents Read。拿不到提交就退出 1，不跳过测试。

脚本不改全局 git 配置。检出放在仓库里的 `.vendor`。链接后的插件树放在 `.dsh-fde-x-test`。`~/.dsh-fde-x` 只在缺失，或已经指向这棵树时，被建成符号链接。如果那里已经是别的路径，脚本退出，不覆盖。`dsh-lan-assist` 会装 `nats@2.29.3`，并核对 `vendor-pins.json` 里的 integrity。semantic-os 自带的 CPython 运行时不在这里下载。

IUI 归档写到 `~/.dsh/vendor/iui/iui-<commit>.tar.gz`。`iui-retry` 和 `iui-core-failure` 写死了这个路径。解包后的树在 `.dsh-fde-x-test/vendor/iui`。`FDE_PLUGIN_IUI` 指向它。

装好的变量在 `.test-env`。`test:strict` 只把 `FDE_VENDOR_DIR`、`FDE_PLUGIN_DSH_SEMANTIC_OS`、`FDE_PLUGIN_IUI`、`COREPACK_HOME` 传给测试进程，并清掉 `FDE_DSH_HOME`。`mcpArchivePaths` 看见 `FDE_DSH_HOME` 就会改用 profile 里的 patch，测试自己准备的文件就读不到了。`runtime/config.mjs` 的默认家目录是 `~/.dsh-fde-x`，所以上面的符号链接让测试找到已挂上的插件。
