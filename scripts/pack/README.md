# Pack staging (`scripts/pack`)

Assembles `resources/` for Electron (`spec 09` §6). Version pins live in `pins.mjs`; output shape in `versions.schema.json`.

## Commands

```bash
pnpm build
node scripts/pack/build-iui.mjs
node scripts/pack/stage.mjs
node scripts/pack/verify.mjs
```

`build-iui.mjs` stops before checkout when the `corepack` binary PATH will actually run is older than 0.31.0, including when a newer pnpm shim sits later on PATH. A pnpm shim is checked the same way when no `corepack` binary is on PATH. The check does not depend on the Node major. The Chinese message names the error the probe actually printed (`Cannot find matching keyid` or `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`) and tells you to move `corepack`, `pnpm`, `pnpx`, `yarn`, and `yarnpkg` in that bin directory before `npm install -g pnpm@11.7.0`. Moving first avoids `EEXIST` when corepack and Node share one global bin. The script does not delete those files and does not switch to another toolchain. A real `pnpm` 11.x on `PATH` is used as-is. Check before a Mac self-pack:

```bash
node -v
command -v pnpm || echo "PATH 上没有 pnpm"
command -v corepack || echo "PATH 上没有 corepack"
pnpm --version || true
```

Run the printed loop before `node scripts/pack/build-iui.mjs`. Do not delete the whole directory from `PATH`.

## Environment

| Variable | Purpose |
|----------|---------|
| `FDE_PACK_OUT` | Write resources to this directory instead of repo `resources/` (safe local dry run). |
| `FDE_DSH_NPM_TREE` | Copy an existing `@deepseek-ai/dsh` install tree into `dsh/` (skip `npm pack` / `npm i`). |
| `FDE_STAGE_DSH_FROM_NPM` | Set to `0` to skip npm staging and only use `FDE_DSH_NPM_TREE` or local candidates. Default: `npm pack` + `npm i --omit=dev` in a bundle dir, then copy to `dsh/` and write `bin/dsh`. |
| `FDE_DOWNLOAD_SEMANTIC_RUNTIME` | `1` to download official `*.tar.gz` + `.sha256` from GitHub releases. Default: on when `CI=true`. |
| `FDE_SEMANTIC_RUNTIME_SRC` | User/runtime tree with `current.json` (local copy path). |
| `FDE_VENDOR_DIR` | `~/.dsh/vendor` override. Vendor plugins copy `package.json` `files` (skip `release-dist` / `runtime-dist`). Sidecar Python is only `semantic-runtime/`. |
| `FDE_IUI_ARTIFACT` | Local IUI tarball. Default `scripts/pack/.cache/iui-<commit>.tar.gz` from `node scripts/pack/build-iui.mjs`. `stage.mjs` unpacks it and does not build. `pins.mjs` `artifact.url` stays empty until an upstream release. |
| `FDE_NODE_DIST_TREE` | Copy an existing Node prefix (`bin/node` or `node.exe`) into `node/`. |
| `FDE_STAGE_NODE` | Set to `0` to skip Node dist download (writes a stub). Default: download official Node 24 tarball (nodejs.org, then npmmirror). |

CI sets `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1` on `macos-14` (and matrix peers) so clean runners get a real semantic runtime tree.
