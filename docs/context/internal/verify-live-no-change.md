---
cursor:
  subagentId: "bc-3c4345e0-f12b-5f20-8ece-cbc4ee3a387c"
---

# Live verify · 业务记录「零变化」

**When**: 2026-09-17 ~21:28–21:31 (UTC+8)  
**Claimed code root**: `/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`  
**Live**: `http://127.0.0.1:5174` · workspace **fdex测试1** · BFF `http://127.0.0.1:4318`  
**Screenshot**: [verify-live-no-change.png](../media/verify-live-no-change.png)

## 1. Git (claimed root)

```text
a6cac0c fix(web): keep 返回 and stop reopening cancelled preview   ← HEAD
1452e52 fix(web): Data tabs must not open biz preview
e9050ec fix(web): restore records list on 返回
d3f421b fix(web): biz write path and dismiss preview drawer
…
```

| Check | Result |
|-------|--------|
| `HEAD` | **`a6cac0c8782efb677105d644b8a6e35d0cc1a1fa`** |
| `a6cac0c` ancestor of `HEAD`? | **Yes** (`HEAD` equals `a6cac0c`) |

## 2. Who serves 5174 / 4318?

| Port | PID | Command (abbrev.) | **cwd** |
|------|-----|-------------------|---------|
| **5174** | 72131 | `node …/vite.js --host 127.0.0.1 --port 5174` | **`…/scene-39-personal-workstation`** |
| **4318** | 72130 | `node runtime/server.mjs` | **`…/scene-39-personal-workstation`** |

**5174 cwd vs scene-39**: **Same tree.** Ace is not looking at a different folder via a stale dev server cwd.

**Restart**: Not required for tree mismatch. Vite PID 72131 is already serving this repo; no evidence of a stale other-tree bundle (on-disk `RecordsPanel.tsx` matches loaded behavior below).

## 3. Disk · `RecordsPanel` / dismiss (a6cac0c lineage)

| Symbol / behavior | On disk at claimed root |
|-------------------|-------------------------|
| `listRestoreRef` | `RecordsPanel.tsx` ~169 |
| `handleRecordsBack` | `RecordsPanel.tsx` ~294, wired to **返回** button ~805 |
| `dismissedPreview` | **Not a local identifier in `RecordsPanel`**; dismiss lives in `src/lib/biz-session-sheet.ts` (`dismissedPreviewIds`, `dismissBizPreviewId`, `isBizPreviewDismissed`) and is imported into `RecordsPanel` |

## 4. UI · 业务应用 → 业务记录 (Playwright, same host)

**Navigation**: 顶栏 **业务应用** → 展开浮层 → Tab **业务记录**.

| Question | Observed |
|----------|----------|
| **返回** in records chrome? | **No.** Table header shows only `来源：局域网业务协作适配器 · 改行 …` (no **返回** button). |
| Why (code, not stale bundle)? | `showRecordsBack = Boolean(listRestore)` (`RecordsPanel.tsx` ~170). `listRestore` is set only when `shouldSaveListRestore` runs (~253–268). With **1 row** in the grid and a **改行** preview that does not narrow row count, `currentRows > 1` is false and `narrowing` is false → **snapshot never saved → 返回 never rendered.** |
| **取消** on preview drawer | Present on open **改行确认** drawer. Click **取消** → drawer closes. Switch **应用** ↔ **业务记录** → drawer **stays closed** (dismiss / no reopen in this pass). |
| Ace’s likely “zero change” | The advertised visible affordance (**返回**) does not appear in the common **single-row 改行** path; cancel/reopen fixes are behavioral and easy to miss if the bug was “reopen after cancel” (here: did not reopen after tab switch). |

## 5. Ace should see change?

| | |
|--|--|
| **Yes/No** | **No** for the main visible claim (**返回**), **yes/unclear** for cancel-stays-dismissed (works once in this session; not a new label). |
| **Why** | Correct **HEAD** and **same cwd** on 5174/4318 — not wrong repo, not proven stale Vite tree. **返回** is gated off when the list has only one row, so UI looks unchanged vs before those commits in Ace’s workflow. |

## Actions taken

- Read-only verification; **no** `pnpm` kill, **no** code edits, **no** `git add -A`.
