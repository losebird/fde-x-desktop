# Layout from Explorer (clean v0.6.5 source)
Copied from GitHub tag v0.6.5 clean tarball at /tmp/semantica-v065-clean/semantica-0.6.5/explorer/.
Not from /tmp/semantica065 static and not from rewritten /semantic-os/explorer.
底稿是干净 v0.6.5 源码。只改中文和 DSH 配色。未重写 Sigma/graphology 图。

Patches only: Chinese i18n, DSH --dsw-alias-* theme, /api -> /semantic-os/api + x-dsh-cwd.
No official landing+rail as the product. Home stays our six cards.

## Explore mount
Official GraphWorkspace is built to dist/explore and served at /semantic-os/ws/explore.
ExplorePage imports that ESM and calls mount(el, { cwd }).
Overlay: small ghost back / add-entity / copy-path. Official search is find.
No homemade ring.

## Analyze mount
Official ReasoningWorkspace is built to dist/analyze and served at /semantic-os/ws/analyze.
AnalyzePage imports that ESM and calls mount(el, { cwd }).
Lock-list on the official frame: 往前推 / Rete (product POST /semantic-os/api/reason mode forward|rete).
Run always previews first (`apply_to_graph:false`). Chrome says 预览，不写图 until an explicit 确认写入.
After preview: 确认写入 (second POST, same facts/rules/mode, `apply_to_graph:true`; confirm if graph nonempty) and 打回重做 (clear results, keep facts+rules, no write).
Official write toggle stays default OFF and is hidden so it cannot contradict a 「仅预览」 badge.
After a successful write, chrome says 已写入图.
Official SparqlWorkspace is folded/collapsed by default; errors show a fail sentence.
Small ghost 回首页. No official Analyze tabs/rail as product chrome.

## Decisions mount
Official DecisionWorkspace is built to dist/decisions and served at /semantic-os/ws/decisions.
DecisionsPage imports that ESM and calls mount(el, { cwd }).
Lock-list: 记一条 (product drawer + fail sentence), list + causal chain from official workspace, 先例 via existing /api/decisions/:id/precedents.
No Semantica/SKE brand.

## IO mount
Official ImportExportWorkspace is built to dist/io and served at /semantic-os/ws/io.
IoPage imports that ESM and calls mount(el, { cwd }).
Lock-list: json/csv only, overwrite confirm, fail rollback, export out-of-dir confirm.
Chinese. No Semantica/SKE. RDF overlay is product Python, honest missing extra.
Do not proxy this path to the sidecar.

## Ontology mount
Official VocabularyWorkspace + Enrich EntityResolutionTab + OntologyWorkspace (SHACL/OWL)
built to dist/ontology and served at /semantic-os/ws/ontology.
OntologyPage imports that ESM and calls mount(el, { cwd }).
Lock-list: merge confirm + fail sentences. SHACL/OWL only because official page already has them.
Do not fake SKOS HTTP; official /api/vocabulary/* is proxied, missing extra fails honestly.

## Admin mount
Official ManageWorkspace tabs (KGOverviewTab, LineageDiagram, OntologySummaryTab)
built to dist/admin and served at /semantic-os/ws/admin.
AdminPage imports that ESM and calls mount(el, { cwd }).
Lock-list overlay: ingest six states, cancel/retry/re-ingest, create bridge, change registry, settings drawer.
Ingest status is visible (banner + panel).
