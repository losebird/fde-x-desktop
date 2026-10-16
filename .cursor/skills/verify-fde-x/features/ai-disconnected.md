# AI disconnected shell

The AI main stage stays the workbench home when DSH Host is not connected: the user still sees the shell, a status banner, an empty-session message, and a disabled or failing 新会话 path — never a fake seeded conversation.

## Sub-features

- `ai-home` shows the three-column AI page at `/ai` with 验证工作区.
- `ai-banner-disconnected` shows `核心未接通，无法打开 AI 会话。` (or `核心未接通。` plus the runtime error) when Host is down.
- `ai-empty-session` shows `当前工作区还没有会话` when no session is selected.
- `ai-new-session` keeps the `新会话` control; using it without Host must fail closed (error banner), not create a local fake thread.

## How to get to it (user POV)

- Open `/` or `/ai`.
- Look at the thin status strip under the top bar on the AI page.
- Choose `新会话` in the left column.

## Driving it with control-fde-x

Preconditions:

- Isolated instance is healthy.
- `GET /health` adapters for `ai-runtime` are not `healthy` (typical on a machine without `dsh`). If they **are** healthy, this feature's disconnected assertions are unmet — drive a connected-AI map instead of weakening these checks.

- **Open home.** Run `control-fde-x browser goto /ai`. The main canvas is the AI page, not a data table and not an official DSH settings screen.
- **Read banner.** Run `control-fde-x browser wait --text 核心未接通`. The amber status strip contains `核心未接通`.
- **Empty list.** Run `control-fde-x browser wait --text 当前工作区还没有会话`. The center status is that sentence. No fabricated session titles appear.
- **New session closed.** Choose `新会话`. Run `control-fde-x browser click --role button --name 新会话`. No DSH iframe titled `DSH 会话` appears. An error stays on the status strip or the empty message remains.
- **Proof.** Run `control-fde-x browser snapshot --aria --path ai-disconnected/home.aria.txt` and `control-fde-x browser screenshot --path ai-disconnected/home.png`. Artifacts show `验证工作区`, `核心未接通`, and `当前工作区还没有会话`.

## Gotchas

- A green banner `已连接本地核心` means Host is up. Do not pass this feature by ignoring the banner.
- `正在连接本地核心运行时…` is transient. Wait for `核心未接通` or `已连接本地核心`, not a fixed sleep.
- Left-column `新会话` is still clickable when disconnected. Clicking it is not proof of a working session.
- Do not inject `localStorage` chats or call session-create internals to manufacture a thread for the screenshot.
