# Semantica Decision Intelligence — 包 0 盘点

对照官方生命周期（Record → Link → Query → Govern → Audit）与 sidecar。不改行为。探测日 2026-11-04。

## 官方 API vs sidecar

| 官方 | sidecar | 状态 |
|---|---|---|
| `record_decision` | `record_decision`（记下即落图；`because` 可选） | 有口 |
| `add_causal_relationship` | 记下时决策-决策写 `PRECEDENT_FOR` / `CAUSED`；证据边 `supports` / `leads_to` | 有口（挂在记下里） |
| `find_precedents` / `find_similar_decisions` | `find_precedents`（已记下且未作废） | 有口 |
| `trace_decision_chain` | `get_causal_chain` | 有口 |
| `query_decisions` | `query_decisions` / `list_decisions` | 有口 |
| `analyze_decision_impact` / `analyze_decision_influence` | `analyze_decision_impact`（官方 influence + CAUSED 下游） | 有口（包 3） |
| `check_decision_rules` | `check_decision_rules`（空规则放行；冲突只挡 `record_decision`） | 有口（包 4） |
| PROV-O 决策审计导出 | `lineage` / `export_graph`(id) / `export_decision_prov` 按板 turtle | 有口（包 5） |
| Explorer Decisions 画布 | Memory `decisions` 占官方 `decisions.js` | 台账已占 |

MCP 原生名（`native_entry.MCP_NATIVE` / `tools.js`）含记下/先例/因果链/查板/影响面/规则闸。

## 活窗口数字（cwd `fdex测试` 及同级 fdex*）

| 图 | 节点 | type=decision |
|---|---|---|
| `fdex测试` `.dsh/semantic-os/graph.json` | 382 | **0** |
| `fdex测试2` | 14 | **0** |
| `fdex` | 33 | **0** |

因果边种类以 SKOS/OWL 为主，无 `CAUSED` / `PRECEDENT_FOR` 决策边。

`NO_BECAUSE`：包 1 打点到 `{cwd}/.dsh/semantic-os/decision-skips.jsonl`。

## 验收

- 本文件 + `test/decision-intelligence-inventory.test.js` 锁住有口/缺口。
- 不改 `decisions.js`、不改 `bootstrap.py` 行为、不新开页。

## 包 2 会话 Query（2026-11-05）

会话工具稳定暴露 `query_decisions` / `find_precedents` / `get_causal_chain`。
`route_intent` 拍板 → `find_precedents`（brief 仍可随后打包选项）。
三口都是 fast-read；空图返回空列表。记下的板能被先例检索和因果链翻到。

## 包 3 影响面（2026-11-05）

`analyze_decision_impact` 封装官方 `ContextGraph.analyze_decision_impact` / `analyze_decision_influence`，并始终附上 CAUSED 下游。
REST `GET /semantic-os/api/decisions/:id/impact` 挂在 chain / precedents 旁。不改 `decisions.js`、不新开页。
无下游或空图返回空列表。有 `CAUSED` 边的板能列出影响节点。

## 包 4 规则闸（2026-11-05）

`check_decision_rules` 读工作区 `decision-rules.json`（缺省为空）。官方 default `min_confidence=0.7` 不注入。
冲突只挡 `record_decision`（`RULE_CONFLICT`，不写板），不挡说话。验收：无规则放行；命中规则返回冲突。

## 包 5 审计导出（2026-11-05）

`lineage` 对决策节点同时走 依据/因果边。`export_graph` 带 `id` 或 REST `GET /semantic-os/api/decisions/:id/prov` 与 `/api/provenance?format=turtle` 导出 W3C PROV-O。不改 `decisions.js`、不新开页。验收：已生效板的 PROV 含 `prov:wasDerivedFrom`（依据）和 `prov:wasGeneratedBy`（因果）。
