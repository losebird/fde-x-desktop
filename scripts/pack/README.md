# Pack staging (`scripts/pack`)

Assembles `resources/` for Electron (`spec 09` §6). Version pins live in `pins.mjs`; output shape in `versions.schema.json`.

## Commands

```bash
pnpm build
node scripts/pack/stage.mjs
node scripts/pack/verify.mjs
```

## Environment

| Variable | Purpose |
|----------|---------|
| `FDE_PACK_OUT` | Write resources to this directory instead of repo `resources/` (safe local dry run). |
| `FDE_DSH_NPM_TREE` | Copy an existing `@deepseek-ai/dsh` install tree into `dsh/` (skip `npm pack` / `npm i`). |
| `FDE_STAGE_DSH_FROM_NPM` | Set to `0` to skip npm staging and only use `FDE_DSH_NPM_TREE` or local candidates. Default: `npm pack` + `npm i --omit=dev` in a bundle dir, then copy to `dsh/` and write `bin/dsh`. |
| `FDE_DOWNLOAD_SEMANTIC_RUNTIME` | `1` to download official `*.tar.gz` + `.sha256` from GitHub releases. Default: on when `CI=true`. |
| `FDE_SEMANTIC_RUNTIME_SRC` | User/runtime tree with `current.json` (local copy path). |
| `FDE_VENDOR_DIR` | `~/.dsh/vendor` override. Plugins copy `package.json` `files` (skip `release-dist` / `runtime-dist`). Sidecar Python is only `semantic-runtime/`. |
| `FDE_NODE_DIST_TREE` | Copy an existing Node prefix (`bin/node` or `node.exe`) into `node/`. |
| `FDE_STAGE_NODE` | Set to `0` to skip Node dist download (writes a stub). Default: download official Node 24 tarball (nodejs.org, then npmmirror). |

CI sets `FDE_DOWNLOAD_SEMANTIC_RUNTIME=1` on `macos-14` (and matrix peers) so clean runners get a real semantic runtime tree.
