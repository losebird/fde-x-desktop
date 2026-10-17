# Pack staging (`scripts/pack`)

Assembles `resources/` for Electron (`spec 09` §6). Version pins live in `pins.mjs`; output shape in `versions.schema.json`.

## Commands

```bash
pnpm build
node scripts/pack/build-iui.mjs
node scripts/pack/stage.mjs
node scripts/pack/verify.mjs
```

On Node 26, `build-iui.mjs` stops before checkout when `corepack` on `PATH` is older than 0.31.0, or when that `corepack --version` prints `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`. The message is Chinese and includes commands to install `pnpm@11.7.0` and move that one corepack file aside. It does not switch to another toolchain. Check before a Mac self-pack:

```bash
node -v
command -v corepack || echo "PATH 上没有 corepack"
corepack --version || true
```

If this is Node 26 and `corepack --version` is below `0.31.0`, run the printed `mv` before `node scripts/pack/build-iui.mjs`. Do not delete the whole directory from `PATH`.

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
