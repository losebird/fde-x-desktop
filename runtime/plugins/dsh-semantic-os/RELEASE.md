# Semantic OS release procedure

A public cut may ship **every platform whose CI job passed**, all at the same plugin/runtime version. Missing platforms stay off the Release page; they are not a reason to withhold Mac/Windows.

The full matrix (when green) is:

- `dsh-semantic-os-<version>-darwin-arm64`
- `dsh-semantic-os-<version>-darwin-x64`
- `dsh-semantic-os-<version>-linux-arm64`
- `dsh-semantic-os-<version>-linux-x64`
- `dsh-semantic-os-<version>-win32-x64`

Recommended fdex070 runtimes ship without torch. Do not publish a tree that pulled `cuda-toolkit` or a GPU torch wheel.

1. Trigger `Build platform runtimes` for the release tag (`fail-fast: false`).
2. For each **passed** native job, require:
   - managed Python staging on the target OS/CPU;
   - complete `semantica[explorer,graph-embeddings,documents,parse-pdf,nlp-spacy,tripletstore-oxigraph]==0.7.0` dependency installation;
   - `pip check` and capability imports;
   - sidecar health, token rejection, and authorized graph operation;
   - license inventory, pinned review policy, and copied license texts;
   - bytecode cleanup, symlink materialization, tree-hash verification;
   - relocation into a path containing spaces and a second sidecar E2E.
3. Assemble installer media with `build-release-media.js` (path uses `PLUGIN_VERSION`).
4. Run installer-media E2E from a clean `DSH_HOME`; activation failure must preserve the previous runtime.
5. Archive each media with `archive-release-media.js`, attach it to GitHub Release `v<PLUGIN_VERSION>` (does not use Actions artifact storage), and optionally keep Actions artifacts.
6. Sign/notarize the macOS and Windows wrappers when signing credentials are configured. Unsigned artifacts must be labeled as such.
7. Publish only the archives that passed. README must list which platforms are actually attached.

The npm main package remains small and is used by the installer as the plugin payload. It does not depend on giant npm runtime packages. Runtime dependencies are fully assembled in CI; end users never run pip or modify system Python.
