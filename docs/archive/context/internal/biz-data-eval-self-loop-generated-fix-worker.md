---
cursor:
  subagentId: "bc-232c27c6-8fe2-5f7c-991a-dd996fe4e441"
---

# Generated self-loop X的X fix worker notes

## Code (repo `cursor/eval-three-causes-2d90`)

- `82936d6` — `slots.js`: `isGeneratedSelfLoopSpeech`, `resolveSelfRelationField`, `carriedSelfRelationFromSpec`; `ensurePlanSelfHop` + `enrichStructuredSlots` use plan-carried published self-edge field. Unit test added.
- `e3e4d6a` — `biz.mjs`: pass top-level `relation` through `translateBizIntent` payload.

Overlay copied to `~/.dsh-fde-x/vendor/dsh-lan-assist/`. After `POST /api/v1/ai/reload`, 4318 listener dropped; restarted via tmux `fde-runtime-4318` with `node runtime/server.mjs`.

## Verified locally (preview API, `cwd` = fdex测试)

- `steps` with `relation: manager` + generated speech → hit **80** (not 120).
- Single step `{ relation: 'manager' }` + generated speech → hit **80** after enrich + `ensurePlanSelfHop`.

## Live eval (`biz-data-eval-self-loop-generated-fix-run.mjs`)

Report: `internal/biz-data-eval-self-loop-generated-fix.json`. Screenshots under `media/biz-data-eval-self-loop-generated-fix-*.png`.

**allPass: false.** Pending sheets from AI turns had `steps`/`from`/`relation` null; hitTotal **120** (employee) or **12** (departments whole table). Model is not attaching a published self-edge field on generated `kind的kind` utterances; slots fix applies only when plan carries `relation` (steps/from/top-level after gate).

## Blocker for full pass

Same speech maps to two self-edges (manager/subordinates, parent/children). Without plan `relation`, product must not steal an edge (per fix brief) and must not full-table. Next slice likely: DSH structured bind for generated self-loop speech → published graph edge field, or eval replay with explicit `relation` in gate payload.
