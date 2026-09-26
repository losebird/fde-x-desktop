---
cursor:
  subagentId: "bc-aea46619-2327-43a7-a094-57e6e76a7d7e"
---

# Verify: biz gate actions from vocab (Decision 15)

**Tree:** `scene-39-personal-workstation`  
**Baseline:** `bfa5c1c` (had literal `VOCAB_GATE_ACTIONS` five-string set)  
**After:** `e4988dc`

## Action list source

| Consumer | Source | Notes |
|----------|--------|--------|
| `runtime/biz/gate-action-codes.mjs` `collectGateActionCodes` | Union of workspace **`can`** on each kind row + spoken **动作** clue `values` | Injects `spoken.json` seed when vocab rows omit 口语 row (same as gate) |
| `runtime/routes/biz.mjs` `actionUsesStructuredBind` | `isGateActionCode(action, gateVocabExtra)` | `gateVocabExtra` = `body.kinds` / `body.can` / `body.vocab` merged with preview-loaded memory kinds |
| `runtime/vendor-overlays/dsh-lan-assist/resolve.js` `parseWriteAction` | `collectGateActionCodes(extra)` | DRY with BFF; no local duplicate |
| `/api/v1/biz/preview` | `loadMemoryWorkspaceVocab` → `translateBizIntent(..., { kinds })` | Custom `can` on workspace kinds included without client sending `can` |

**Not** used for structured-bind membership: hardcoded five-name set (removed).

## Hardcoded action-name literals (structured bind path)

| Location | Before | After |
|----------|--------|-------|
| `biz.mjs` `VOCAB_GATE_ACTIONS` | `Set(['现查','改行','新建','删除','过审'])` | **Removed** |
| `biz.mjs` `actionUsesPreviewPatch` | `改行` / `新建` only | **Unchanged** (patch shape for record.update/create aliases; not the Decision 15 gate set) |
| `resolve.js` `ACTION_PRIORITY` | tie-break order for speech | **Unchanged** (disambiguation, not bind allowlist) |
| `RECORD_ACTION_ALIASES` | API → spoken tokens | **Unchanged** (transport mapping, not allowlist) |

## Proof

```text
node --test runtime/tests/biz-where.test.mjs runtime/tests/slots-enrich.test.mjs runtime/tests/where-pass-labels.test.mjs
# 16 pass (biz-where +8 incl. custom `can` 封存)
```

## 未对 / 仍差

- **现网未测** — 5174 preview after BFF reload with workspace-only custom `can`.
- **parseWriteAction** on preview path — still upstream of BFF; BFF now aligns allowlist with resolve helper.

## SHA

- Parent hop: `bfa5c1c`
- This hop: `e4988dc`

`e4988dc` deploy: overlay copied **yes** (`resolve.js` → `~/.dsh-fde-x/vendor/dsh-lan-assist/`); reload **yes** (`POST /api/v1/ai/reload` 200); 4318 recycled **yes** (listener pid 2004 @ 13:40:08, supervised respawn); connect **yes** (DSH pid 2471). Companion: `~/.dsh/biz/gate-action-codes.mjs` (resolve import) — required for plugin boot after overlay.

## Overlay self-contained (`8f23673`)

Canonical `collectGateActionCodes` / `isGateActionCode` live in `runtime/vendor-overlays/dsh-lan-assist/gate-action-codes.mjs`; `resolve.js` imports `./gate-action-codes.mjs`; BFF `runtime/biz/gate-action-codes.mjs` re-exports the overlay module. After `cp` overlay → `~/.dsh-fde-x/vendor/dsh-lan-assist/`, removed `~/.dsh/biz/gate-action-codes.mjs`, `POST /api/v1/ai/reload` (Origin `http://127.0.0.1:5174`) 200, then `POST /api/v1/ai/connect` 200 (`connected: true`, DSH pid 3994, `lastError: null`). **sidecar gone: yes**; **connect ok: yes**; **SHA: `8f23673`**.
