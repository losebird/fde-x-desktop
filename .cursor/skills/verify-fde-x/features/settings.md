# Settings

设置 lets a user open the settings stage and switch among the listed sections. Host-backed editors (AI 核心, 语义记忆, MCP writes) may be empty or error when DSH is down; the section list itself still works.

## Sub-features

- `settings-open` opens the 设置 stage from the top bar or `/settings`.
- `settings-sections` shows 账户, 外观, 通知, 快捷键, AI 核心, 语义记忆, 运行环境, 存储与数据.
- `settings-appearance` shows the 外观 body after choosing that section (default section on first open is 外观).
- `settings-runtime` opens 运行环境 and can refresh `/health` without crashing the panel.

## How to get to it (user POV)

- Choose `设置` in the top bar.
- Open `/settings` (rewrites to `/ai` with the panel open).
- Choose a section button in the left card.

## Driving it with control-fde-x

Preconditions:

- Isolated instance is healthy.
- Top bar shows 验证工作区.

- **Open settings.** Choose `设置`. Run `control-fde-x browser open --name 设置`. The stage title bar reads `设置`. Section button `外观` is present.
- **Deep link.** Run `control-fde-x browser goto /settings`. After settle the URL is `/ai` and the stage title bar still reads `设置`.
- **Switch section.** Choose `运行环境`. Run `control-fde-x browser click --role button --name 运行环境`. The section is selected. A health or error line may appear; either is acceptable if the panel stayed on 设置.
- **Proof.** Run `control-fde-x browser snapshot --aria --path settings/open.aria.txt` and `control-fde-x browser screenshot --path settings/open.png`. Artifacts show 验证工作区, stage `设置`, and at least `账户` + `外观`.

## Gotchas

- In-panel `h1` 「设置」 is hidden by `.stage-content [data-page-title-text]`. Use the stage chrome label and the section buttons.
- Saving MCP / credentials / 重载核心 talks to Host. Those writes are other features; a down Host is an unmet precondition, not a pass via a mocked 200.
- `resetDemo` / 存储与数据 destructive actions wipe the Chrome persist. Do not click them on a shared profile; this skill's profile is disposable, but doing so drops 验证工作区 and invalidates the rest of the run.
