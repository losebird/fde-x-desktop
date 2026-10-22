# Confirm / form remount + kitchen hand test

Date: 2026-08-19 (Asia/Shanghai)

Package: `/workspace/dsh-plugins/dsh-semantic-os`  
Engine: `semantica==0.6.5` via `DSH_SEMANTICA_PYTHON=/tmp/semantica065/bin/python`  
Kitchen: `http://127.0.0.1:3080` cwd `/home/box/reference`  
Canvas: official Explorer kept. Asset cache `?v=dsos10`.  
Did not edit `/workspace/deepseek-harness`. Twelve tool names unchanged. No keys written.

## Files

### Updated
- `client.js` — remount 记一条 / 查找 / 实体消歧 / SPARQL on `dsos-bar`. DecisionForm empty fields → `decision.form.fail` (no raw sidecar). ErBar merge confirm kept; merge body aligned to 0.6.5 `{ primary_id, duplicate_ids }`. Accept/reject still fail-map to acceptFail/rejectFail/mergeFail.
- `http.js` — explorer boot: intercept iframe POST `/api/enrich/merge` with `window.confirm("合并后不能拆开。确定合并？")` (cancel → 499, no request). Official SPARQL workspace collapse + expand button. Cache `dsos9` → `dsos10`. Boot has no `//` comments.

### New
- `CONFIRM-TEST-REPORT.md` — this file

## A. Product chrome remount

| Item | Status |
|---|---|
| 记一条 → `setDrawer("decision")` + DecisionForm | **done** |
| 查找 → FindBar on bar (`/semantic-os/nodes?cwd&q`) | **done** |
| 实体消歧 → `setDrawer("er")` + merge `window.confirm(t("er.mergeConfirm"))` | **done** |
| SPARQL → `setDrawer("sparql")` + SparqlPanel `open` initial **false** | **done** |
| Existing bar kept (ingest / 加实体 / 桥 / 设置 / 导入导出 / 复制路径 / 变更登记) | **kept** |
| Drawer titles decision / sparql / er | **already mapped, still work** |
| Enter / Esc | **unchanged** (Esc closes; Enter clicks primary / DecisionForm submit) |

### Official boot
- Merge fetch intercept **is mounted** (served in explorer HTML, confirm string present, `?v=dsos10`).
- Official SPARQL collapse **is injected** (`collapseOfficialSparql` + `#dsos-sparql-expand`). Selectors: `.ws-page` + `.ws-pill` containing SPARQL + `.monaco-editor`/`textarea` (matches 0.6.5 `SparqlWorkspace`).
- Not browser-clicked on a logged-in Semantic tab this pass. Product SPARQL drawer still defaults collapsed. If official Analyze page uses a different DOM than `SparqlWorkspace`, that page would not collapse — product drawer still folded.

## B. Kitchen hand test

Restart (two commands, separate):

```
pkill -f "dsh --profile web --host 127.0.0.1 --port 3080"
# wait until port 3080 free
DSH_SEMANTICA_PYTHON=/tmp/semantica065/bin/python dsh --profile web --host 127.0.0.1 --port 3080
```

`GET /semantic-os/ready` → 200 ready, version `0.6.5`, python `/tmp/semantica065/bin/python`, llm DSH `deepseek-official` / `deepseek-v4-flash`. POST used `Origin: http://127.0.0.1:3080`.

### 1. Dual-session shared-write banner — PASS

Same cwd, two sessionIds. First start still `running` when second start + GET landed.

| Call | Status | Evidence |
|---|---|---|
| `POST /semantic-os/ingest/start` sessionId=`sess-a` | 200 | `state:running` `sharedWrite:false` |
| `POST /semantic-os/ingest/start` sessionId=`sess-b` | 200 | `state:running` **`sharedWrite:true`** |
| `GET /semantic-os/ingest?cwd=/home/box/reference&session=sess-b` | 200 | `state:running` **`sharedWrite:true`** |
| `GET …&session=sess-a` | 200 | `sharedWrite:true` (writers>1) |

Client already draws `ingest.sharedWriteBanner` when `ingest.sharedWrite`. **sharedWrite was seen on the Host snapshot.**

### 2. Mid-ingest cancel — PASS

First cancel attempt after B1 hit `state:done` (pipeline already finished). Immediate start+cancel:

| Call | Status | Evidence |
|---|---|---|
| `POST /semantic-os/ingest/start` sessionId=`sess-cancel` | 200 | `state:running` |
| `POST /semantic-os/ingest/cancel` | 200 | **`state:cancelled`** `detail:cancelled` |
| `GET /semantic-os/ingest?cwd=…&session=sess-cancel` | 200 | `state:cancelled` |

### 3. Session-end auto record — PASS

Did **not** listen to `session/disposed`. Used settings overlay + `POST /semantic-os/archive-record`.

| Step | Evidence |
|---|---|
| Default | `GET /semantic-os/settings` → `sessionEndRecord:false` |
| Turn on | `POST /semantic-os/settings` `{sessionEndRecord:true}` → 200; persist `/home/box/.dsh/dsh-semantic-os.json` = `{ "sessionEndRecord": true }` |
| Archive | `POST /semantic-os/archive-record` `{cwd, sessionId:sess-end-1}` → 200 `{decision_id:"68ef53ad-d06e-4553-8c20-f969cf385a02", status:"recorded"}` |
| Written | `query_decisions` list includes that id, `metadata.category=session_end`, scenario `archived session sess-end-1` (17:35 CST) |
| Turn off | overlay `{ "sessionEndRecord": false }` |
| Skip | `POST /semantic-os/archive-record` → 200 `{ok:true, skipped:true}` |

Note: `query_decisions` with `args.category=session_end` returns `[]` because it reads top-level `category`, not `metadata.category`. Write itself succeeded.

### 4. Create-mode twelve tools — PASS (table only)

`tools.js` names exactly twelve, in order:

`extract_entities extract_relations record_decision query_decisions find_precedents get_causal_chain add_entity add_relationship run_reasoning get_graph_analytics export_graph get_graph_summary`

| Call | Status | Evidence |
|---|---|---|
| `POST /semantic-os/python` `get_graph_summary` | 200 | `node_count:41` `decision_count:3` `graph_ready:true` path `/home/box/reference/.dsh/semantic-os/graph.json` |
| `POST /semantic-os/python` `query_decisions` `{limit:5}` | 200 | decisions list (includes session_end row) |

Kitchen profile is `web` only (`~/.dsh/profiles/web`). There is `cordis.yml` (empty `[]` root) but **no create profile**. Did not open a create-mode UI. **One tool table; no create-mode UI.**

### 5. Real merge pair — PASS

0.6.5 `MergeRequest` (`semantica/explorer/schemas.py`): `{ primary_id: str, duplicate_ids: List[str] }`.

| Step | Status | Evidence |
|---|---|---|
| `add_node` `merge-alpha` / `merge-alpha-dup` | 200 | `{"status":"added","id":"merge-alpha"}` / `merge-alpha-dup` |
| Official `POST /semantic-os/api/enrich/merge` Origin + `x-dsh-cwd` body `{"primary_id":"merge-alpha","duplicate_ids":["merge-alpha-dup"]}` | **200** | `{"merged_into":"merge-alpha","removed_ids":["merge-alpha-dup"],"edges_updated":0}` |
| Client merge confirm | code path | `window.confirm(t("er.mergeConfirm"))` before fetch; boot confirm `合并后不能拆开。确定合并？` |
| Empty body | **422** (not 500) | missing `primary_id` / `duplicate_ids` |
| `{primary_id:"", duplicate_ids:[]}` | **404** (not 500) | `Primary node  not found` |

Client fail path maps non-ok to `er.mergeFail` / acceptFail / rejectFail (no 500).

## Restart

```
pkill -f "dsh --profile web --host 127.0.0.1 --port 3080"
DSH_SEMANTICA_PYTHON=/tmp/semantica065/bin/python dsh --profile web --host 127.0.0.1 --port 3080
```

Two commands, separate. Plugin already a symlink.

## Blockers

- Official SPARQL collapse is in the served boot, not visually confirmed on a logged-in Analyze/SPARQL page.
- `query_decisions` category filter does not see `metadata.category` (does not block session_end write).
- None for Host APIs in B1–B5.

## Top bar now

摄取状态 / 再摄取 / 路径输入 / 加实体 / 创建桥 / 打开设置 / 导入 JSON / 导入 CSV / 导出 JSON / 导出 CSV / 复制路径(+id 输入) / 变更登记 / **记一条** / **查找** / **实体消歧** / **SPARQL**
