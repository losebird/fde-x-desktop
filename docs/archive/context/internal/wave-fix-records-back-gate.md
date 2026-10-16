---
cursor:
  subagentId: "bc-cd2441bb-e155-5057-ad63-93d3fcd7c735"
---

# Wave: 返回 gate — 1-row 改行 preview

## SHA

`main` @ **74b3005**

## Change

`RecordsPanel.tsx`:

- Before applying write-preview sheets, `ensureListRestoreBeforeWritePreview` captures restore target from current rows (larger/different set), `kind:` session cache (`priorListSheetByKind` + skip overwriting `kind:` with single-row write previews), and same-kind list surfaces in session history.
- Re-run ensure when `surfaces` load while a write preview is active (hydrate race).
- `showRecordsBack` unchanged: `Boolean(listRestore)` after restore target differs from incoming preview.

## Verification (http://127.0.0.1:5174)

- Path: 业务应用 → 业务记录 → 现查 20 行 → 行内「改行」→ 1-row preview + drawer.
- **返回 visible on 1-row 改行 when prior list exists:** **yes**
- Screenshot: `files/media/records-back-visible.png`

## 1-row hydrate-only (no prior list in memory)

Not re-tested cold-load AI-only path in this pass; restore still depends on an in-session list snapshot (rows, kind cache, or surface metadata + cached sheet). No fake 返回 when none exists.
