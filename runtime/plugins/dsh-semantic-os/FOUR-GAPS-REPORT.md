# Four product-layer gaps

Date: 2026-08-19 (Asia/Shanghai)

Package: `/workspace/dsh-plugins/dsh-semantic-os`  
Engine: `semantica==0.6.5` via `DSH_SEMANTICA_PYTHON=/tmp/semantica065/bin/python`  
Canvas: official Explorer kept. Asset cache still `?v=dsos9` (http/boot not bumped).  
Did not edit `/workspace/deepseek-harness`. Twelve tool names unchanged. No keys in plugin/logs.

## Files

### New
- `annotations.js` — product notebook `{cwd}/.dsh/semantic-os/annotations.json` (`{ version:1, items:[{ id, note, path, ts }] }`). list/add. No cwd → refuse. Not the engine GraphSession store.
- `FOUR-GAPS-REPORT.md` — this file

### Updated
- `product.js` — `GET /semantic-os/lineage`, `GET|POST /semantic-os/annotations`, `POST /semantic-os/export`
- `client.js` — remount `ImportBar`; export JSON/CSV; copy-path + id input; registry drawer. New DICT keys. Did not remount 记一条 / SPARQL / 实体消歧 / 查找
- `src/locales/zh.json` + `en.json` — `lineage.copied` `lineage.copyFail` `registry.add` `registry.note` `registry.path` `registry.fail` `registry.productHint`
- `package.json` — `files` includes `annotations.js`
- `http.js` — product path exclusions for lineage/export/annotations only (no boot/`//`, no `dsos10`)
- `python/bootstrap.py` — `export_graph` uses 0.6.5 `JSONExporter`/`CSVExporter` with required `file_path` (temp file, then return `data`). json/csv only.

## Four items

| # | Item | Status |
|---|---|---|
| 1 | Import overwrite confirm + fail restore on chrome | **done** | `ImportBar` remounted on `dsos-bar`. Confirm + json/csv + `import.failRestored` already existed. |
| 2 | Lineage copy real path | **done** | Host `GET /semantic-os/lineage?cwd=&id=` → sidecar `GET /api/provenance?node_id=` (0.6.5 param). Pull path/source/file/realpath/uri (+ official `source_document`). Fallback node metadata. `{ ok, id, path }` realpath-style; else `{ ok:false, error:'NO_PATH' }`. Chrome: id input (`kg.addEntity.id`) + `jump.copyPath`. |
| 3 | Change registry notebook | **done** | Product file, not engine. Drawer `tab.registry` + hint `registry.productHint`. |
| 4 | Export outside cwd must confirm | **done** | `POST /semantic-os/export` `{ cwd, format, dest?, confirm? }`. format json/csv else `REJECT_FORMAT`. No dest → `{ ok, format, data }` (Blob download). dest outside cwd + `confirm!==true` → `OUTSIDE_CWD` (no write). `path.resolve` + `fs.realpath`. Chrome prompt then `window.confirm(export.outsideCwdConfirm)` on OUTSIDE_CWD. |

### Top bar now
摄取状态 / 再摄取 / 路径输入 / 加实体 / 创建桥 / 打开设置 / 导入 JSON / 导入 CSV / 导出 JSON / 导出 CSV / 复制路径(+id 输入) / 变更登记

Not on the bar: 记一条, SPARQL, 实体消歧, 查找节点.

## Curl (127.0.0.1:3080, Origin required on POST)

| Check | Result |
|---|---|
| `POST /semantic-os/import` `.ttl` | 400 `REJECT_FORMAT` |
| `POST /semantic-os/export` no dest json | 200 `{ ok, format:json, data }` |
| `POST /semantic-os/export` dest=`/tmp/out.json` no confirm | 400 `OUTSIDE_CWD`; file not created |
| `POST /semantic-os/export` format=ttl | 400 `REJECT_FORMAT` |
| `POST /semantic-os/annotations` | 200 item written to `{cwd}/.dsh/semantic-os/annotations.json` |
| `GET /semantic-os/annotations?cwd=` | 200 lists items |
| `POST /semantic-os/annotations` no cwd | 400 `NO_CWD` |
| `GET /semantic-os/lineage` missing id | 400 `{ ok:false, error:NO_PATH }` (not 500) |
| `GET /semantic-os/lineage` unknown id | 200 `{ ok:false, error:NO_PATH }` (not 500) |
| `GET /semantic-os/lineage` file node | 200 `{ ok:true, path:"/home/box/reference/app-ui.md" }` |
| `GET /semantic-os/ready` | ready, version `0.6.5` |

## Restart

```
pkill -f 'dsh --profile web --host 127.0.0.1 --port 3080'
DSH_SEMANTICA_PYTHON=/tmp/semantica065/bin/python dsh --profile web --host 127.0.0.1 --port 3080
```

Two commands, separate. Plugin already a symlink.

## Blockers

None for Host APIs. Kitchen chrome (clipboard / confirm / drawer) needs a logged-in browser session.

`export_graph` on 0.6.5 required a `file_path`; product no-dest path writes a temp file then returns `data`. Dest writes stay on the Host after the outside-cwd gate.
