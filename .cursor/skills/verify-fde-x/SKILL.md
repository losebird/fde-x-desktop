---
name: verify-fde-x
description: Drive the FDE-X Desktop web shell the way a user does — isolated Vite+BFF instance, top-bar modules, business apps, and public /a share — and capture proof. Use when verifying UI or BFF behavior, after changing shell/apps/share/settings, or before claiming a user-visible change works.
---

# Verify FDE-X Desktop

You are driving the **FDE-X 工作台** web shell, not DSH's official UI, not `dsh-lan-assist/client.js`, and not `dsh-semantic-os/client.js`. Primary surface is the browser at an isolated Vite origin. Secondary surfaces: BFF HTTP (same instance), public `/a/:shareId` on the **BFF port** for hosted web apps. Desktop packaging (`apps/desktop`) is out of scope for this skill.

Read `features/README.md` and the matching feature file before you click. A proof that only hits one convenient entry point is incomplete when the map lists others.

## Launch

Never use `npm start` / `npm run dev` for verification. Those reuse `127.0.0.1:4318` / `5174` and `runtime/data/fde-workstation.sqlite` — the user's live workstation. Never use `npm run dev:peer` (`5175` / `4319`).

Repo deps must already be installed (`npm i` at the repo root). BFF imports `zstdDecompress` from `node:zlib` — that needs **Node ≥ 22.15**. If `node` on PATH is older, set `FDE_VERIFY_NODE` to a newer binary (the helper also looks under `~/.nvm/versions/node/`). If `runtime/.host-generation/node_modules/yaml` is missing (no DSH generation pin on this machine), launch installs `yaml` there as **verification scaffolding**. That directory is gitignored; do not commit it. Then:

```bash
.cursor/skills/verify-fde-x/bin/control-fde-x launch
```

Optional: `--run-id <id>` for a stable directory.

This creates a disposable tree under `~/.cache/fde-x-verify/<run-id>/` (or `$FDE_VERIFY_ROOT`), starts **this run's** `runtime/server.mjs` and Vite, and refuses ports `4318`, `4319`, `5174`, `5175`.

Ready is **not** "a port answers". Launch succeeds only when all of these are true:

1. `GET http://127.0.0.1:<runtime>/health` → `service=fde-x-runtime` and `state=healthy` (SQLite migrated; `PRAGMA quick_check` ok). AI / IM / semantic adapters may be `unavailable` — that is still a usable shell.
2. `GET http://127.0.0.1:<web>/ai` returns the Vite document (`id="root"`).
3. Seed is in: SQLite workspace `ws_verify` + cwd `$RUN/workspace`; active hosted web app **验证户型** (`slug=verify-floor`) whose `index.html` contains `FDE-X-VERIFY-FLOOR`.
4. A throwaway Chrome profile has hydrated zustand persist `scene-39-workstation` so the top bar shows **验证工作区**. Linux cannot pick a folder (`dir_picker_unavailable`); do not expect the workspace switcher to create a cwd without this seed.

Printout includes `web`, `runtime`, `evidenceDir`, `seededApp`. Teardown is `control-fde-x cleanup` (see Cleanup). Two isolated runs can sit side by side (different ports + data + DSH home + Chrome profile). If you cannot isolate, **do not drive** a shared instance.

## Doctor

Run this first whenever anything looks off:

```bash
.cursor/skills/verify-fde-x/bin/control-fde-x doctor
```

It is read-only. It must report: our pids still alive, ports are the ones in state (never the user ports above), `/health` fingerprint matches `sha256(FDE_DATABASE_PATH)[:12]`, Vite `/ai` is our HTML. Exit `2` means refuse to drive.

```bash
.cursor/skills/verify-fde-x/bin/control-fde-x state
```

## Drive

Harness is `control-fde-x`. Prefer accessible names and `data-*` hooks from this repo over coordinates.

```bash
.cursor/skills/verify-fde-x/bin/control-fde-x browser goto /ai
.cursor/skills/verify-fde-x/bin/control-fde-x browser open --name 业务应用
.cursor/skills/verify-fde-x/bin/control-fde-x browser click --selector [data-app-create-entry="true"]
.cursor/skills/verify-fde-x/bin/control-fde-x browser fill --role textbox --name 名称 --value 验证草稿
.cursor/skills/verify-fde-x/bin/control-fde-x browser wait --text 我的业务应用
.cursor/skills/verify-fde-x/bin/control-fde-x http GET /health
.cursor/skills/verify-fde-x/bin/control-fde-x http POST /api/v1/apps/APP_ID/share
```

Stable handles (do not invent new ones):

| User thing | Handle |
|---|---|
| Top-bar modules | `button[title="设置"]` or `button[title^="早报 ·"]` (pinned labels append ` · 默认钉住`; IM appends ` · AI 可自动调用`). `control-fde-x browser click --name 设置` uses this title hook so it does not hit the thumbnail `关闭设置` / 工作区工具 copy |
| Workspace chip | `button` titled `当前工作区: 验证工作区`, visible text `验证工作区` |
| Command palette | `button` titled `⌘+K 全局搜`, or `Control+k` / `Meta+k` |
| Right-stage chrome | visible label in the stage title bar (`业务应用`, `设置`, …). In-panel `h1` under `[data-page-title-text]` is `display:none` — do not require it to be visible |
| App catalog | `[data-app-catalog="true"]`, row `[data-app-row="<id>"]`, name `[data-app-row-name="验证户型"]` |
| Create | `[data-app-create-entry="true"]` label is `创建草稿` without an AI session, `创建应用` with one |
| Wizard | `[data-app-create-wizard]` , textboxes named `名称` / `目标`, buttons `创建草稿` / `生成` / `关闭` |
| Share | `[data-app-share="true"]`, note `[data-app-share-note="true"]` |
| Public hosted web | **BFF** `http://127.0.0.1:<runtime>/a/<shareId>/` — not Vite `/a/` |

Deep links `/data`, `/settings`, `/files`, … open the matching panel then `replace` to `/ai`. After that the URL is `/ai` even though the panel is open. Prefer the top-bar button.

`control-fde-x http` always sends `Origin` of this run's Vite origin. Writes without Origin are `403` by design.

AI, IM, memory, and "生成" (the builder that talks to DSH) need a connected Host. On a machine without `dsh`, prove the **disconnected** shell and local SQLite/app paths; report Host-backed entry points as unmet preconditions, do not substitute an internal setter.

## Evidence

Put proof under `.cursor/skills/verify-fde-x/artifacts/<run-id>/` (the path `launch` prints as `evidenceDir`). Relative `--path` on snapshot/screenshot lands there.

```bash
.cursor/skills/verify-fde-x/bin/control-fde-x browser snapshot --aria --path shell-nav/open.aria.txt
.cursor/skills/verify-fde-x/bin/control-fde-x browser screenshot --path shell-nav/open.png
```

Proof standards:

- Exercise the real user path (top bar, catalog buttons, copied share URL). Do not PATCH zustand or POST test-only endpoints to fake a click.
- Capture the action **and** the resulting state (ARIA snapshot + screenshot with 工作台 identity: 验证工作区 and the module label). On Linux, install `fonts-noto-cjk` before treating a screenshot as readable; the ARIA file is the text authority if glyphs tofu.
- Mutations need a second read: catalog row, `GET /api/v1/apps`, or a new tab on the public URL.
- Hosted web share is proven when the public document body contains `FDE-X-VERIFY-FLOOR` and does **not** contain the workbench SPA (`data-page-title`, 顶栏模块).
- Mocks only at production boundaries (DSH / lan-assist / semantic-os). If those processes are down, say so; do not treat `/health` adapter `unavailable` as a product bug by itself.

## Cleanup

```bash
.cursor/skills/verify-fde-x/bin/control-fde-x cleanup
```

Kills **only** the pids recorded in this run's state (process tree, SIGTERM then SIGKILL). Removes the run directory (sqlite, DSH home, Chrome profile). **Does not** delete `evidenceDir`. Never `pkill -f vite` / `pkill -f server.mjs`.

After cleanup, confirm the artifact files still exist at the printed `evidenceDir`.

## Helpers

`.cursor/skills/verify-fde-x/bin/control-fde-x` is executable. First `browser` call may `npm install` Playwright inside the skill folder (verification scaffolding, not a product dependency). It drives system `chrome` (`channel: 'chrome'`).

```bash
.cursor/skills/verify-fde-x/bin/control-fde-x launch
.cursor/skills/verify-fde-x/bin/control-fde-x doctor
.cursor/skills/verify-fde-x/bin/control-fde-x browser open --name 设置
.cursor/skills/verify-fde-x/bin/control-fde-x cleanup
```
