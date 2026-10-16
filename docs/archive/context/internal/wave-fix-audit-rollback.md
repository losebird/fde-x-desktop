# Wave: audit history + rollback

## SHA

`a32629b` (main)

## 操作控制 tab

- **Hidden:** no — same slot, label **操作记录** (`Data.tsx` `ViewButton`).
- **Plan form removed:** yes — `OperationControlPanel` re-exports `OperationRecordPanel` (no「新建操作计划」).

## Rollback confirm

- **UI:** yes — `BizRollbackConfirmDrawer` + shared `PreviewChangesList` (same field diff layout as `BizPreviewDrawer`).
- **Flow:** row → 回退 → confirm changed fields only → `POST /api/v1/biz/rollback/preview` → `biz_write` on confirm (no silent write).
- **Playwright:** `scripts/verify-audit-history.mjs` — tab/plan checks green; rollback drawer needs a row with `biz_write_audit.changes` (seed/API verified: `canRollback: true` on `trace_seed_audit`).

## Evidence

- Screenshot: [audit-history.png](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/media/audit-history.png)
- API sample (seeded audit): `GET /api/v1/biz/traces?cwd=<scene-root>` returns `changesSummary` + `canRollback`.

## Backend reuse

- `GET /api/v1/biz/traces` — lan-assist traces + `biz_write_audit` enrichment.
- `POST /api/v1/biz/write` — persists `changes` from pending sheet / request body.
- `POST /api/v1/biz/rollback/preview` — inverse patch preview for confirm write.
