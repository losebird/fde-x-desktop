# Business apps catalog

业务应用 is the directory of the user's apps. The user opens the catalog, creates a local draft without AI, and opens the seeded hosted web app 验证户型 as a working surface — not a fake ledger table.

## Sub-features

- `apps-open` shows 我的业务应用 with metrics and the seeded 验证户型 row.
- `apps-create-entry` reveals the create wizard from `创建草稿` (no AI session) or `创建应用` (with one).
- `apps-draft` saves an empty draft from 名称 + 创建草稿 and lists it under 草稿.
- `apps-open-hosted` opens 验证户型 and shows its live document (`FDE-X-VERIFY-FLOOR`).
- `apps-generate` ("生成") requires a connected AI core. Without it the button reads `请先连接 AI 核心` and stays disabled.

## How to get to it (user POV)

- Choose `业务应用` in the top bar.
- Open `/data` (rewrites to `/ai` with the panel open).
- Choose `应用` / `业务记录` / `操作记录` in the remaining title actions.
- Choose `创建草稿` or `创建应用`, then `创建草稿` or `生成` inside the wizard.
- Choose the 验证户型 row.

## Driving it with control-fde-x

Preconditions:

- Isolated instance is healthy.
- Seeded app **验证户型** is `active`.
- No leftover draft titled `验证草稿`.

- **Open catalog.** Choose `业务应用`. Run `control-fde-x browser open --name 业务应用`. `[data-app-catalog="true"]` shows `我的业务应用` and `[data-app-row-name="验证户型"]` with tag `运行中`.
- **Open wizard.** Choose the catalog entry. Run `control-fde-x browser click --selector [data-app-create-entry="true"]`. `[data-app-create-wizard]` appears. The generate button's name is `请先连接 AI 核心` when Host is down.
- **Create draft.** Fill 名称 and save. Run `control-fde-x browser fill --role textbox --name 名称 --value 验证草稿` and `control-fde-x browser click --role button --name 创建草稿`. A draft named `验证草稿` appears (草稿 section). `control-fde-x http GET "/api/v1/business/apps?workspaceId=ws_verify"` includes that name.
- **Open hosted app.** Choose `验证户型`. Run `control-fde-x browser click --selector [data-app-row-name="验证户型"]`. The working surface (iframe or live root) contains `FDE-X-VERIFY-FLOOR`. It is not a three-tab ledger.
- **Proof.** Run `control-fde-x browser snapshot --aria --path business-apps/catalog.aria.txt` and `control-fde-x browser screenshot --path business-apps/catalog.png` on the catalog or open-app state. Artifacts identify 验证工作区 and 验证户型. Second read: the HTTP list still contains both 验证户型 and 验证草稿.

## Gotchas

- Without an AI session the entry label is `创建草稿`, not `创建应用`. Use `[data-app-create-entry="true"]` if the label shifts.
- `生成` talks to DSH. A down Host is an unmet precondition for `apps-generate`, not a reason to POST a spec behind the wizard.
- `业务记录` / `操作记录` are other tabs. Opening them does not prove the catalog.
- Apps are filtered by workspace id/cwd. If the chip is not 验证工作区, the seed row is missing — fix launch seed, do not create the app through an internal repo helper.
- Remove `验证草稿` during fixture cleanup; keep the proof files.
