---
cursor:
  subagentId: "bc-5d3a5d06-380d-5082-b5cf-2419af819ef8"
---

# Generated self-loop X的X — fix-2 worker

## Code (`0c05a47` on `cursor/eval-three-causes-2d90`)

- `slots.js`: `generatedSelfLoopEdgePeers`, `generatedSelfLoopPeerOnlyPlan`; ambiguous `kind的kind` attaches relation peers instead of flat hop/full table.
- `write.js`: merge self-loop peers after enrich; `packPeerSheets` runs self-edge hop when `peer.relation` is set (same kind allowed); peer-only main uses `settledList` hitTotal 0.
- `plan.js`: peers keep `relation` through `normalizePlan`.
- Tests: `slots-enrich.test.mjs` (2 cases), `write-hop-actions.test.mjs` (gate peer-only, not 120).

Overlay copied to `~/.dsh-fde-x/vendor/dsh-lan-assist/`. `POST /api/v1/ai/reload` via 5174 returned 500; **4318 not listening** in this session.

## Live eval

`internal/biz-data-eval-self-loop-generated-fix-2-run.mjs` → **blocked `ai/not-connected`** (BFF/4318 down). No `media/biz-data-eval-self-loop-generated-fix-2-*.png` shots.

Re-run when runtime + AI connected: same script writes `internal/biz-data-eval-self-loop-generated-fix-2.json` and four footer clips.
