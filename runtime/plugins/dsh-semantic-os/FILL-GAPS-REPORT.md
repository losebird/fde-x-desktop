# Semantic OS gap fill report

Date: 2026-08-19 (Asia/Shanghai)

Package: `/workspace/dsh-plugins/dsh-semantic-os`  
PRD: `/workspace/PRD-dsh-semantic-os.md` v1.16  
Engine lock: `semantica==0.6.5` via `DSH_SEMANTICA_PYTHON=/tmp/semantica065/bin/python`  
Canvas: official Explorer same-origin `GET /semantic-os/explorer` (not replaced)  
Asset cache: `?v=dsos9`

Did not edit `/workspace/deepseek-harness`. Did not open a PR on deepseek-ai/deepseek-harness. Did not change the wheel.

## Files touched

### New
- `ingest.js` — per-cwd ingest queue (idle/queued/running/done/failed/cancelled), shared-write flag, post-ingest pipeline, `postPython()`
- `gate.js` — Host `tools/pre-execute`; only `next()` on allow; warn = official ask; hard gates always on
- `bridge.js` — `{DSH_HOME}/semantic-os/bridge/index.json`, protocol 1, version reject
- `product.js` — same-origin product APIs under `/semantic-os` (ingest, nodes, probe, cli, python, import, bridge, writes, archive-record)
- `python/policy/default/pack.yml` + `README.md` — default policy pack, copied only when workspace `ontology/policy/` is empty
- `FILL-GAPS-REPORT.md` — this file

### Updated
- `python/bootstrap.py` — `ingest_directory`, `run_pipeline` (extract → kg_build → dedup), `add_node`, `policy_check`, `import_graph` (json/csv + backup/restore), `copy_default_policy`; `extract_relations(text, entities)`
- `persist.js` — `ingestStrategy` default `mtime`, `sessionEndRecord` default false; `saveOverlay` merges previous overlay
- `http.js` — product handler before official proxy; `redactDoctor`; explorer asset `?v=dsos9`
- `index.js` — wires ingest + writes + gate; archive listeners `workspace.archiveSession` / `host/archived-sessions-changed` (not `session/disposed`); `session/created` → `ingest.ensure`
- `tools.js` — `writes.mark` on mutating tools; still exactly twelve names
- `client.js` — chrome on official iframe (ingest / decision / entity / SPARQL / ER / bridge / settings / find / import); dock `semantic-os-jump` order 15; `inject=['slots','workspaces','sessions','locale']`; compiled zh/en dictionaries
- `src/locales/zh.json` + `src/locales/en.json` — 195 matching keys (FR-16 table plus product extras; no historic `settings.mergeHiddenHint` / `er.mergeHidden`)
- `package.json` — `files` includes new Host modules and default policy pack

### Not changed (on purpose)
- `cordis.patch.yml`, bundled preset
- Twelve Host tool names
- Official Explorer iframe / boot (no `//` comments added)
- `dsh-llm.js` (models stay with DSH; no engine key box)

## 15 blocks (parent list; 7 and 8 each cover two PRD rows)

| # | Block | Status | Notes |
|---|---|---|---|
| 1 | Ingest FR-03 / FR-18 | **done** | Six states + `failReason` (NO_CWD / BAD_CWD / NOT_READY) + cancel / retry / reIngest / optional paths + `sharedWriteBanner`. Failure does not flip plugin not-ready. Strategy hint = mtime incremental. After another session leaves `running`, chrome reloads the iframe from the same cwd `graph.json`. Host `session/created` + Client `ingest/ensure`. |
| 2 | Pipeline FR-04 | **done** | After ingest, sidecar `run_pipeline` runs extract → kg_build → dedup via `PipelineBuilder` + `ExecutionEngine.execute_pipeline`. `ingest.retry` sets `retryPipeline` and re-runs extract. Verified live: `steps=["extract","kg_build","dedup"]`. Conflict/Ontology are not required DSL stages. |
| 3 | Decision form FR-05 / FR-21 | **done** | Chrome form (category, scenario, reasoning, outcome, confidence) → sidecar `record_decision`. Fail shows `decision.form.fail`, not a raw dump. Session-end auto-record default **OFF**. Host only listens to archive events, not `session/disposed`. |
| 4 | ER FR-06 | **partial** | Chrome accept / reject / merge POST official `/semantic-os/api/enrich/merge` (same-origin official mount). Merge asks `er.mergeConfirm`. Fail keys `er.acceptFail` / `er.rejectFail` / `er.mergeFail`. Official Ontology Hub editor stays in the iframe. Dedup is scan-only. No unmerge. **Gap:** chrome asks the user for two ids; live `MergeRequest` field names were not proven against a real conflict pair. |
| 5 | Gate FR-07 / FR-22 | **done** (Host) | `tools/pre-execute`: allow → `next()`; deny/ask do not `next()`; warn returns official ask (no `ctx.approval.request`). Hard gates: not-ready, no cwd, decisions REST write, export outside cwd (ask). PolicyEngine true/false only. Default pack copied only if `ontology/policy/` is empty. Blocked tools record `outcome=blocked`. Not live-fired through a model turn in this pass. |
| 6 | Import / export FR-08 | **partial** | Product buttons json/csv only. Non-empty graph → `import.confirmOverwrite`. Fail → restore `graph.json.bak` + `import.failRestored`. Bad ext → `io.rejectFormat` (curl `.ttl` → `REJECT_FORMAT`). No RDF/OWL REST button. **Gap:** lineage realpath + copy is a locale key (`jump.copyPath`); there is no extra lineage chrome — official Explorer provenance stays the canvas. |
| 7a | Find FR-09-find | **done** | `GET /semantic-os/nodes?cwd&q` forwards official `POST /api/graph/search` body `query` or `GET /api/graph/nodes?search=`. No wrap-then-filter. Live `q=gap` returned official hits (`gap-node-1`, `gap-node-2`). |
| 7b | Add entity FR-09-add | **done** | Form keys `kg.addEntity.id/label/type/fail` → sidecar `add_node`. Live add `gap-node-2` → `{"status":"added"}`. Enter submits (drawer primary button); Esc closes; focus returns to the opener. |
| 8 | Settings FR-11 / FR-12 / FR-13 | **done** with intentional skip | Drawer: doctor (redacted `sk-…`), wheel version, loopback + real port, graph path, ready/not-ready, explorer extra, `retryReady`, eleven probes, CLI `settings.cliDeveloper`, hard-gate list, policy pack, session-end toggle, `ingest.strategyHint`. Fork sentences: `settings.anonymousForbidden` / `settings.startTimeout` / `settings.versionMismatch` / `settings.extraMissing`. **No engine-key input** (models follow DSH). `settings.keyWrite` explains that. No pip sentence copied into business TS. |
| 9 | Bridge FR-14 | **done** | `{DSH_HOME}/semantic-os/bridge/index.json`. Wizard: node → target cwd → `listNodes` → confirm. Either side can delete. Version mismatch refuses write (curl `pluginVersion=9.9.9` → `version_mismatch`). Open peer = chain A new session, does not rewrite current cwd. Copy uses `bridge.pastePath` / `bridge.openYourself`. |
| 10 | Locales FR-16 | **done** | zh/en 195 keys, compiled into `client.js` (no runtime JSON import). Client visible strings go through `t(key)`. Historic merge-hidden keys not added. |
| 11 | SPARQL FR-19 | **done** | Default collapsed (`sparql.expand` to open). Fail `sparql.fail`. Read-only official `POST /semantic-os/api/sparql`. |
| 12 | Residual FR-17-residual | **done** | `openedElsewhere` replaces `empty.noCwd`; only `firstRun.selectWorkspaceOnHeader`; `firstRun.selectCwd` is not drawn on that empty state. |
| 13 | Dock hint | **done** | `conversation.input.dock` id `semantic-os-jump` order 15. Polls writes / ingest; shows `jump.openShell` / `jump.graphUpdated`. No `setView`. Hidden while the shell is open. |

## Install / restart / verify

```
dsh plugin --profile web add /workspace/dsh-plugins/dsh-semantic-os
# result: already linked (link:../../../../../workspace/dsh-plugins/dsh-semantic-os)

# stop and start MUST be two commands
pkill -f 'dsh --profile web --host 127.0.0.1 --port 3080'
DSH_SEMANTICA_PYTHON=/tmp/semantica065/bin/python dsh --profile web --host 127.0.0.1 --port 3080
```

Live results (127.0.0.1:3080, after the last restart):

| Check | Result |
|---|---|
| `GET /` kitchen | 200 |
| `GET /semantic-os/ready` | ready, version `0.6.5`, doctor has no `sk-` values, llm = DSH `deepseek-official` / `deepseek-v4-flash` |
| `GET /semantic-os/explorer?cwd=/home/box/reference&lang=zh` | 200, official canvas + boot |
| `GET /semantic-os/nodes?cwd=…&q=gap` | official search, 3 hits |
| `POST /semantic-os/python` `run_pipeline` | `steps=["extract","kg_build","dedup"]` |
| `POST /semantic-os/ingest/retry` | running → done, pipeline ok |
| `POST /semantic-os/python` `add_node` | added `gap-node-2` |
| `POST /semantic-os/python` `record_decision` missing field | `missing required field: scenario` (UI maps to `decision.form.fail`) |
| `POST /semantic-os/import` `.ttl` | `REJECT_FORMAT` |
| `POST /semantic-os/bridge` bad version | `version_mismatch` |
| `GET /semantic-os/settings/probe` | 11 groups; no 404. `decisions` is 422 (official GET needs params). `ingestStrategy=mtime`, `sessionEndRecord=false` |
| `GET /semantic-os/bridge` | protocol 1, existing links |

POSTs to product APIs need `Origin: http://127.0.0.1:3080` (Host `isTrustedRequest`).

## Hand test (kitchen)

1. Open `http://127.0.0.1:3080`, pick a workspace, open the **Semantic** tab (order 11). Official Explorer iframe must stay.
2. Chrome: ingest state, cancel / retry / re-ingest, optional paths. Fail must show `ingest.failReason`, not a plugin crash.
3. 「记一条」: five fields; a missing field shows `decision.form.fail`.
4. 「加实体」: id / label / type; Enter submits, Esc closes, focus returns.
5. SPARQL drawer starts collapsed; a bad query shows `sparql.fail`.
6. ER: merge confirm; a failed write shows the fail key, not a raw 4xx.
7. Import only json/csv; overwrite confirm; restore sentence on fail.
8. Settings: doctor, version, loopback+port, graph path, probes, CLI developer, hard gates, strategy hint, session-end OFF. No engine-key box.
9. Bridge wizard; version mismatch refuses; open peer opens another session.
10. A residual session (cwd already open elsewhere) shows `openedElsewhere` + header hint only.
11. Stay on Chat after a write: dock text `jump.graphUpdated` / `jump.openShell`. Do not expect an auto tab switch.

## Remaining gaps

- ER chrome is id-pair + official merge POST; not a full official conflict-pair inbox. Merge body alignment vs 0.6.5 `MergeRequest` not proven on a real pair.
- Lineage realpath+copy is not a second lineage panel (official Explorer remains the canvas).
- Shared-write banner + iframe reload after the other session leaves `running` is coded, not two-session live-tested.
- Mid-ingest cancel and default policy-pack first copy were not live-tested this pass.
- Official doctor text still names `OPENAI_API_KEY=…` as Semantica’s own hint (ellipsis, not a secret). Product redaction only strips `sk-…`. We do **not** alias DeepSeek keys to `OPENAI_API_KEY`.
- Settings probe uses a lab cwd when pinging sidecar routes; statuses are still the eleven official groups.
- Official Explorer raw HTML still contains the upstream “Semantica” string; boot remaps visible labels. Product chrome has no Semantica / SKE brand.

## Blockers

None for Host/product APIs. Kitchen UI chrome needs a logged-in browser session (not curl).

## Package / add / verify / remove

```
# path
/workspace/dsh-plugins/dsh-semantic-os

# add (already a file link in the web profile)
dsh plugin --profile web add /workspace/dsh-plugins/dsh-semantic-os

# verify
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/
curl -sS http://127.0.0.1:3080/semantic-os/ready
curl -sS -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3080/semantic-os/explorer?cwd=/home/box/reference&lang=zh'
curl -sS 'http://127.0.0.1:3080/semantic-os/nodes?cwd=/home/box/reference&q=gap'
curl -sS -H 'Origin: http://127.0.0.1:3080' 'http://127.0.0.1:3080/semantic-os/settings/probe'
curl -sS 'http://127.0.0.1:3080/semantic-os/bridge'

# unload (do not run unless asked)
dsh plugin --profile web remove dsh-semantic-os
```
