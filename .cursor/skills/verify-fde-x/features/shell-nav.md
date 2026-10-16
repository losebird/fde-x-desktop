# Shell navigation

Shell navigation lets a user open each top-bar module as the right-hand stage (or IM/memory workspace) while AI stays the main canvas, and see the module's own chrome and body.

## Sub-features

- `nav-topbar` opens each labeled module from the pill bar.
- `nav-deeplink` opens the same modules from `/briefing`, `/plan`, `/files`, `/data`, `/mcp`, `/skills`, `/memory`, `/settings` then lands back on `/ai`.
- `nav-palette-control` exposes the ⌘K control (the palette itself lists Host search hits; empty Host is an unmet precondition, not a skip of the control).
- `nav-workspace-chip` keeps **验证工作区** visible while modules change.

## How to get to it (user POV)

- Choose `IM`, `早报`, `计划`, `文件`, `业务应用`, `连接器`, `技能`, `记忆`, or `设置` in the top pill bar.
- Open `http://127.0.0.1:<web>/<module>` (then the shell replaces the URL with `/ai`).
- Choose the `⌘K` control, or press `Control+k` / `Meta+k`.
- `/` redirects to `/ai`.

## Driving it with control-fde-x

Preconditions:

- Isolated instance is healthy (`control-fde-x doctor`).
- Top bar shows `验证工作区`.
- Viewport width ≥ 1280.

- **Home.** Open the AI canvas. Run `control-fde-x browser goto /ai`. The workspace chip reads `验证工作区`. The address is `/ai`.
- **Open 业务应用.** Choose `业务应用`. Run `control-fde-x browser open --name 业务应用`. The stage title bar reads `业务应用` and the catalog heading `我的业务应用` is visible. `验证户型` is listed. `open` is idempotent (does not toggle a full stage shut).
- **Open 设置.** Choose `设置`. Run `control-fde-x browser open --name 设置` then `control-fde-x browser wait --role button --name 外观`. The stage title bar reads `设置`. Buttons `账户` and `外观` are visible. Do not `wait --text 账户` — that hits the hidden PageTitle subtitle. `open --name 设置` uses the top-bar `title="设置"` control, not the thumbnail.
- **Deep link.** Open files via URL. Run `control-fde-x browser goto /files`. After settle, `control-fde-x browser url` is `/ai` and the stage title bar reads `文件`.
- **Palette control.** Choose ⌘K. Run `control-fde-x browser click --role button --name "⌘+K 全局搜"`. A search field appears. If Host search is empty, record that; do not treat a missing result list as a failed control.
- **Proof.** With `业务应用` open, run `control-fde-x browser snapshot --aria --path shell-nav/open.aria.txt` and `control-fde-x browser screenshot --path shell-nav/open.png`. Both artifacts show `验证工作区` and `我的业务应用`.

## Gotchas

- Top-bar labels use `hidden md:inline`. A narrow viewport leaves only icons; `--name 业务应用` then fails.
- `/data` opens 业务应用 then rewrites to `/ai`. Assert the stage, not `window.location.pathname === '/data'`.
- In-panel `h1` under `[data-page-title-text]` is hidden. The visible title is the stage chrome label.
- `早报` starts as `tab` (thumbnail), not `full`. The first click still opens it.
- Do not drive the user's 5174 instance to "save time".
- Headless Chrome without CJK fonts tofu the top-bar labels. Install `fonts-noto-cjk` or rely on the ARIA snapshot for text.
