# Agent entry

When changing runtime, AI, IM, memory, business apps, MCP, Skills, files, or deleting SessionIsland: read `HANDOFF.md` then `PRODUCTION-SPEC.md`. **§0.5 overrides every conflicting earlier clause, except the §0.6 surface grant.** Do not restyle FDE-X outside that grant. Do not invent pages.

## Surface grant

On 2026-10-16 the operator authorized style and interaction work on three existing right-hand panels only. The grant is `PRODUCTION-SPEC.md` §0.6.

- 连接器: `src/pages/MCP.tsx`
- 技能: `src/pages/Skills.tsx` and skill UI that panel renders
- 设置: `src/pages/Settings.tsx`, `src/components/settings/**`, and the kit in `src/components/surface/**`

Shared tokens live in `:root` kit variables and the `kit` keys in `tailwind.config.js`. They must not change the existing `btn`, `card`, `brand`, `rounded`, or `shadow-card` classes other pages already use.

Everything else stays on the old clauses. That includes the shell (`IMScreen`, `StagePanel`, `FloatingPanel`, `ThumbnailStack`, header), the AI conversation iframe, and every other page. Do not add a top-bar module, a dark theme, or i18n. Settings forms stay generated from the Host schema. Do not hardcode one field.

Session canvas is the existing AI iframe (`/dsh-app/`): only conversation occupancy (`chat`, `trajectory`, composer). Occupancy wraps `slots.register` when `ui-renderer` provides the service (`runtime/canvas-occupancy.mjs`). Disable catalog column plugins in `dsh-core.patch.yml`. Blank session uses `data-phase=hero` (composer only). File/plan/memory `land` through `openRef`. Terminal is an accessory block on the AI page.

Catalog kinds `land` through `openRef` onto existing FDE-X pages. Session kinds with no catalog page (terminal) are an accessory block on the existing AI page. Unknown kind → Settings plugin overflow. Window-scoped capabilities stay in Desktop packaging.

Shared live apps use `/a/:shareId` (ledger `PublicApp` or hosted web bundle). That is the app document mouth, not a new top-bar module.

Do not restyle FDE-X. Do not invent FDE chrome pages. Hosted apps live as cwd bundles + iframe, not new files under `src/pages/` per app.
