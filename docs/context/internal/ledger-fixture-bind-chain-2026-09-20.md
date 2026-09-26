---
cursor:
  subagentId: "bc-c2f7c794-9be2-5baa-aa8e-c55d6ffd95eb"
---

# 小区水电抄表 fixture + 问 AI bind chain（只读审计）

## 1. Live fixture proof

**Store path (authoritative):**  
`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation/runtime/data/fde-workstation.sqlite`  
(`runtime/config.mjs` default `FDE_DATABASE_PATH`; DB mtime **2026-09-20 19:14** on this machine.)

**Row `business_apps.id = app_9de6038b186a4e9786e28bc4f48add9d` (sqlite3):**

| field | live value |
|---|---|
| name | 小区水电抄表 |
| status | active |
| app_kind | generated |
| workspace_id | ws_personal |
| current_revision | 1 |
| updated_at | 2026-09-19T14:45:27.484Z |
| definition_json → uses | `["ai","plan"]` |
| definition_json → spec slug | `estate-meter-log` |
| definition_json → name | 小区水电抄表 |
| materialized table | `app_estate-meter-log__meter_reading` (exists in same DB) |

**Live BFF cross-check (2026-09-20, host up):**  
`GET http://127.0.0.1:4318/api/v1/business/apps?workspaceId=ws_personal` → same id/name/status, `uses ['ai','plan']`.

**Not used for proof:** `verify-app-create-av.md` / old JSON snapshots (cited only as historical corroboration).  
**Note:** duplicate draft同名 `app_07cd41a2204f4cbab1d583185f7fdcae` also named 小区水电抄表; **LEDGER_ID 固定的是 active 这条**。

`~/.dsh-fde-x/fde-x.sqlite` has **no** `business_apps`; app catalog lives in workstation runtime DB above.

---

## 2. UI bind chain: `[data-app-use="ai"]` click

| step | location |
|---|---|
| DOM | `AppCapabilityBar` button `data-app-use={use}` |
| handler | `onClick={() => { void run(use) }}` → `runDeclaredPlatformUse(use, spec, appId, …)` |
| `use === 'ai'` | **`loadCurrentWorkspaceCwd()` only** — **does not** call `loadCurrentAiTarget()` |
| session | **`runtimeApi.createAiSession({ cwd })`** — **always new session** |
| title | `renameAiSession(created.sessionId, \`${spec.name} · 问\`)` → 抄表为 **「小区水电抄表 · 问」** |
| navigate | `setActiveAiSessionId(created.sessionId)` + `fde-x-ai-open` + `promptAi(created.sessionId, …)` 应用上下文首条 |

**Contrast:** `loadCurrentAiTarget()` (`src/lib/ai-target.ts`) picks **existing** primary session for cwd (RecordsPanel / IM / ⌘K / `ask-ai.ts`). **App 产品页「问 AI」走 create 分支，不是 currentAiTarget。**

File:line chain:

- `scene-39-personal-workstation/src/components/apps/AppCapabilityBar.tsx` **78–84** → **36–40** (`run`)
- `scene-39-personal-workstation/src/lib/app-platform.ts` **156–177** (`runDeclaredPlatformUse`, `use === 'ai'`)
- `scene-39-personal-workstation/src/lib/ai-target.ts` **47–56** (`loadCurrentWorkspaceCwd`), **58–76** (`loadCurrentAiTarget` — unused by app 问 AI)

---

## 3. Verify scripts (AgentStore `internal/`)

### 3a. `LEDGER_ID` / `app_9de6038b…` constant

All bind **Decision 22** block: catalog → `[data-app-row="${LEDGER_ID}"]` → product → `[data-app-use="ai"]` click:

| script | LEDGER | ask click line |
|---|---|---|
| verify-records-bind-pipe-bi.mjs | 25, 572–580 | 577–580 |
| verify-records-bind-pipe-bh.mjs | 27, 532–540 | 537–540 |
| verify-records-close-bg.mjs | 35, 1173–1181 | 1178–1181 |
| verify-records-query-miss-bf.mjs | 34, 999–1007 | 1004–1007 |
| verify-records-close-be.mjs | 33, 1078–1086 | 1083–1086 |
| verify-records-close-bd.mjs | 33, 1044–1052 | 1049–1052 |
| verify-records-close-bc.mjs | 30, 869–877 | 874–877 |
| verify-records-close-bb.mjs | 30, 865–873 | 870–873 |
| verify-records-close-ba.mjs | 30, 844–852 | 849–852 |
| verify-app-create-az.mjs | 25, 569–573 | 573 |

**Also references LEDGER_ID but no 问 AI click on it:** verify-app-create-ax.mjs, verify-app-create-ay.mjs (open/list only).

### 3b. Any `[data-app-use="ai"]` click (broader)

Additional scripts that **click** 问 AI but **not** pinned to LEDGER_ID (other apps / create flow):

- verify-app-create-av.mjs — click **448–449** (first on **家里的菜谱** after create; ledger created later in same run)
- verify-app-create-az.mjs — ledger (above)
- verify-app-product-au.mjs, verify-app-product-at.mjs — **350 / 306** (e.g. 资料卡片板, not LEDGER constant)
- verify-app-product-am/ak/aj.mjs, verify-app-create-product.mjs — locate only, no `.click()` in grep

Float verify scripts use `data-app-use="float"` / `briefing` / `memory`, not ai.

### 3c. 「停用客户还有哪些没关的工单？」 + ~19:09–19:13

**Scripts with that speech in hop/case 1:**

- verify-records-bind-pipe-bi.mjs **400–401** (`promptWait`)
- verify-records-bind-pipe-bh.mjs (same pattern)
- verify-records-close-bg/bf/be/bd/bc/bb/ba.mjs — case 1 `speech` in CASES array

**Live run artifact (bi, not md):**  
`verify-records-bind-pipe-bi.json` → `sessionId` **session-29041d8a-544f-4eed-88ca-c6feaa264778**; `hop1.footer` **「…现查 19:09」**; `hop1.speech` path via `promptWait` POST `/api/v1/ai/sessions/:id/prompt`.

---

## 4. Mtimes / logs 19:08–19:14 (local)

| file | mtime |
|---|---|
| verify-records-bind-pipe-bi.json | 2026-09-20 **19:14:40** |
| verify-records-bind-pipe-bi.mjs | 2026-09-20 19:06:37 |
| verify-records-bind-pipe-bi.md | 2026-09-20 19:18:30 (after window) |
| verify-records-bind-pipe-bh.* | 2026-09-20 **18:16–18:18** (earlier run) |

No `verify-records-bind-pipe-bi.run.log` in store. JSON hop timestamps align with **19:09** footer text.

---

## 5. Hop session vs D22「抄表-问」session

| | Records hops (case/hop 1–3, approve, short) | D22 问 AI on 抄表 fixture |
|---|---|---|
| Session creation | One `POST /api/v1/ai/sessions` at start; `out.sessionId` seeded in UI (bi **350–364**) | **`createAiSession` again** inside `runDeclaredPlatformUse('ai')` on button click |
| Prompt path | `promptWait` → `POST /api/v1/ai/sessions/${out.sessionId}/prompt` (bi **274–281**) | Auto `promptAi` on **new** session with app intro text (app-platform **174–176**) |
| UI surface | 业务记录 iframe + biz pending sheet | 应用 catalog → 抄表 product → 问 AI chip |
| Expected left title | Generic session list; hop text in **iframe** left blob | New session titled **「小区水电抄表 · 问」** (av/az product verify asserts `/ · 问/`; bi D22 only checks aside width + `/会话/` via `measureChrome`, not title string) |
| Same session? | **No** — D22 click spawns a **second** AI session; does not reuse hop `sessionId` |

Hops **do not** go through `[data-app-use="ai"]` on the ledger app; they only share the same browser run **before** the D22 catalog step.

---

## 6. create-app verify ↔ fixture

- **verify-app-create-av.mjs** reads live DB path **`${SCENE}/runtime/data/fde-workstation.sqlite`** (line 20) and creates apps from wizard; proves uses=ai,plan at creation time (JSON listedBefore includes LEDGER id).
- **LEDGER_ID hard-coded** in ax/ay/az and all records-close/bind scripts = **stable active row** above, not wizard output id guess.
