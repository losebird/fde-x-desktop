# Bound-set remain and cancel provenance

Author runs on this workspace. Not a Mac pass.

## Commands

Failing remain test, recorded before the remain fix, saved as `bound-set-remain-fail.tap`:

```
node --test --test-concurrency=1 --test-reporter=tap runtime/tests/bound-set-remain.test.mjs
```

Result: fail 1. Four rows posted. `pendingSheet` still held `EXP20260629627`, `EXP20250805461`, and `EXP20240226276`, plus the unwritten `EXP-KEEP`.

Passing tests after both fixes, saved as `pass.tap`:

```
node --test --test-concurrency=1 --test-reporter=tap runtime/tests/bound-set-remain.test.mjs runtime/tests/cancel-provenance.test.mjs
```

Result: pass 3, fail 0.

Plugin lock, saved as `plugins-lock.txt`:

```
node scripts/plugins/plugins-lock.mjs
```

Result: `plugins.lock verify ok`. mismatch 0.

Published `@deepseek-ai/*@0.2.0-rc.2` bundles, saved as `published-0.2.0-rc.2.txt`. Each cancel string matched once. First apply patched 9 files. `node --check` exited 0 on each patched file. Second apply was already. Goal pause still has one `kind: "parent"`.

## Hashes

File content sha256, not a git head.

```
69a7ba21082de72810c3665eb327312f53bbbcdca2b149f7827a973242c51541  bound-set-remain-fail.tap
5e279f71cfc0f22ddd5f7d70b5fb5d17ae57d327282065f36573470ad3f08cf9  pass.tap
d3020329ab3ae0319b19daca60e95ce7dd4e631bc72ef7d913a20884a9df0a44  published-0.2.0-rc.2.txt
63e223c83a59b613d03a65c61742c8d5364de1d78a2bdff82c908054f132c73a  plugins-lock.txt
```
