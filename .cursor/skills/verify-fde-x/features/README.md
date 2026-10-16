# FDE-X verification map

This directory is the maintained source for verifying the user-facing behavior of FDE-X Desktop. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `.cursor/skills/verify-fde-x/bin/control-fde-x launch` (isolated ports, sqlite, DSH home, Chrome profile).
- `control-fde-x doctor` reports this run's Vite origin, BFF origin, and sqlite fingerprint.
- Top bar shows workspace **验证工作区**.
- Catalog contains active hosted web app **验证户型** (`verify-floor`) whose live HTML contains `FDE-X-VERIFY-FLOOR`.
- Never drive `127.0.0.1:5174` / `4318` or `5175` / `4319`.
- Viewport ≥ 1280px so top-bar labels (`hidden md:inline`) are visible.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Prefer `getByRole` names and `data-*` hooks listed in the skill. Treat commands as literal.
- After opening a module from a deep link, the URL returns to `/ai`; assert the stage title bar, not the path.
- Restore seeded data after a mutation. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot that shows 验证工作区 plus the module or app under test.
- HTTP proof includes method, path, status, and a parsed body field.
- Mutation proof includes a second read (catalog, `GET /api/v1/apps`, or a new public tab).
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition. Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-fde-x` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Shell navigation](./shell-nav.md) covers top-bar modules, deep links, and the command-palette control.
- [AI disconnected shell](./ai-disconnected.md) covers the empty / unconnected AI main stage when DSH Host is down.
- [Business apps catalog](./business-apps.md) covers the 业务应用 directory, draft creation without AI, and opening 验证户型.
- [Public share](./public-share.md) covers sharing a hosted web app and opening `/a/:shareId` as that site.
- [Settings](./settings.md) covers the 设置 panel and its section list.
