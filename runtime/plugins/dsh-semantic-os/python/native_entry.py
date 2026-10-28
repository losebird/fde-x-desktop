"""In-process Semantica entries for PR6. Feature flags turn each mouth off."""

from __future__ import annotations

import os
import subprocess
import sys
from typing import Any

MCP_NATIVE = (
    "record_decision",
    "find_precedents",
    "get_causal_chain",
    "run_reasoning",
    "query_graph",
    "extract_entities",
    "extract_relations",
    "add_entity",
    "add_relationship",
    "get_graph_analytics",
    "export_graph",
    "get_graph_summary",
    "search_text",
    "lineage",
    "list_memory_cards",
    "query_decisions",
)

CONNECTOR_EXTRAS = (
    "bigquery", "redshift", "snowflake", "databricks", "salesforce", "sap",
    "powerbi", "airflow", "gdrive", "huggingface", "mcp", "mongo", "elastic", "kafka",
)


def flag(name: str, default: bool = True) -> bool:
    raw = os.environ.get(f"DSH_SEMANTIC_OS_{name}")
    if raw is None:
        return default
    return str(raw).strip().lower() not in {"0", "false", "off", "no"}


def explorer_enabled() -> bool:
    return flag("EXPLORER", True)


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if hasattr(value, "__dict__"):
        packed = {k: _jsonable(v) for k, v in vars(value).items() if not str(k).startswith("_")}
        if packed:
            return packed
    text = getattr(value, "text", None)
    label = getattr(value, "label", None)
    if text is not None:
        return {"text": str(text), "label": str(label or "")}
    return str(value)


def run_semantica_help(_cwd: str = "", _args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not flag("CLI", True):
        return {"ok": False, "error": "FLAG_OFF", "flag": "CLI"}
    try:
        import shutil
        cmd = shutil.which("semantica") or sys.executable
        argv = [cmd, "--help"] if cmd.endswith("semantica") or cmd.endswith("semantica.exe") else [sys.executable, "-m", "semantica", "--help"]
        proc = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception as exc:
        return {"ok": False, "error": "CLI_FAILED", "detail": str(exc)[:200]}
    body = (proc.stdout or proc.stderr or "").strip()
    return {"ok": proc.returncode == 0, "help": body[:4000], "engine": "semantica"}


def run_semantica_capabilities(_cwd: str = "", _args: dict[str, Any] | None = None) -> dict[str, Any]:
    extras = {
        "explorer": explorer_enabled(),
        "cache": flag("CACHE", True),
        "graphrag": flag("GRAPHRAG", True),
        "schema": flag("SCHEMA", True),
        "tiers": flag("TIERS", True),
        "tms": flag("TMS", True),
        "erasure": flag("ERASURE", True),
        "conflicts": flag("CONFLICTS", True),
        "policy": flag("POLICY", True),
        "cli": flag("CLI", True),
    }
    optional: dict[str, bool] = {}
    for name, mod in (
        ("viz", "semantica.visualization"),
        ("media", "semantica.parse.media"),
    ):
        try:
            __import__(mod)
            optional[name] = True
        except Exception:
            optional[name] = False
    optional["torch"] = False
    connectors = []
    for name in CONNECTOR_EXTRAS:
        connectors.append({"name": name, "extra": True, "connected": False})
    return {
        "ok": True,
        "flags": extras,
        "optional": optional,
        "connectors": connectors,
        "mcp": list(MCP_NATIVE),
        "export_methods": _export_methods(),
    }


def _export_methods() -> list[str]:
    try:
        from semantica.export.methods import list_available_methods
        packed = list_available_methods()
        if isinstance(packed, dict):
            names: list[str] = []
            for rows in packed.values():
                if isinstance(rows, list):
                    names.extend(str(x) for x in rows)
            return sorted(set(names))
    except Exception:
        pass
    return ["rdf", "owl", "json"]


def run_community_rag(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not flag("GRAPHRAG", True):
        return {"ok": False, "error": "FLAG_OFF", "flag": "GRAPHRAG"}
    args = args or {}
    from stores import read_edge_rows, read_node_rows

    nodes, _st = read_node_rows(cwd)
    edges = read_edge_rows(cwd)
    entities = [{"id": str(row.get("id") or ""), "type": str(row.get("type") or "Entity"), "name": str(row.get("content") or "")} for row in nodes if row.get("id")]
    relationships = [{"source": str(e.get("source") or ""), "target": str(e.get("target") or ""), "type": str(e.get("type") or "related_to")} for e in edges if e.get("source") and e.get("target")]
    try:
        from semantica.kg.community_hierarchy import CommunityHierarchyBuilder
        hierarchy = CommunityHierarchyBuilder(algorithm=str(args.get("algorithm") or "louvain")).build(
            {"entities": entities, "relationships": relationships}
        )
    except Exception as exc:
        return {"ok": False, "error": "GRAPHRAG_BUILD", "detail": str(exc)[:240]}
    reports = []
    try:
        from semantica.kg.community_summarizer import CommunitySummarizer
        summarizer = CommunitySummarizer(llm=None)
        packed = summarizer.summarize_hierarchy(hierarchy) if hasattr(summarizer, "summarize_hierarchy") else []
        reports = _jsonable(packed)
    except Exception as exc:
        reports = {"via": "template", "detail": str(exc)[:200]}
    retrieved = {}
    try:
        from semantica.context.context_retriever import ContextRetriever
        retriever = ContextRetriever(community_hierarchy=hierarchy, community_reports=reports if isinstance(reports, list) else None, llm=None)
        query = str(args.get("q") or args.get("query") or "社区")
        retrieved = {
            "global": _jsonable(retriever.retrieve_global(query)),
            "drift": _jsonable(retriever.retrieve_drift(query)),
        }
    except Exception as exc:
        retrieved = {"via": "template", "detail": str(exc)[:200]}
    meta = getattr(hierarchy, "metadata", None) or {}
    communities = getattr(hierarchy, "communities", None) or {}
    return {
        "ok": True,
        "engine": "semantica",
        "algorithm": (meta.get("algorithm") if isinstance(meta, dict) else "louvain") or "louvain",
        "community_count": len(communities) if hasattr(communities, "__len__") else 0,
        "reports": reports,
        "retrieve": retrieved,
    }


def run_schema_gate(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not flag("SCHEMA", True):
        return {"ok": False, "error": "FLAG_OFF", "flag": "SCHEMA"}
    args = args or {}
    from semantica.semantic_extract.schema import ExtractionSchema, Predicate
    from semantica.semantic_extract.schema_validator import SchemaValidator
    from semantica.semantic_extract.types import Entity

    concepts = args.get("concepts") or ["PERSON"]
    if isinstance(concepts, str):
        concepts = [concepts]
    predicates_in = args.get("predicates") if isinstance(args.get("predicates"), dict) else {}
    predicates = {}
    for name, spec in predicates_in.items():
        if isinstance(spec, dict):
            predicates[str(name)] = Predicate(
                name=str(spec.get("name") or name),
                domain=frozenset([str(spec.get("domain") or "")] if spec.get("domain") else []),
                range=frozenset([str(spec.get("range") or "")] if spec.get("range") else []),
            )
        else:
            predicates[str(name)] = Predicate(name=str(name))
    schema = ExtractionSchema(concepts=frozenset(str(x) for x in concepts), predicates=predicates)
    rows = args.get("entities") if isinstance(args.get("entities"), list) else []
    ents: list[Any] = []
    for row in rows:
        if isinstance(row, dict):
            label = str(row.get("label") or row.get("type") or "")
            text = str(row.get("text") or row.get("name") or "")
        else:
            continue
        if text and label:
            ents.append(Entity(text=text, label=label, start_char=0, end_char=max(len(text), 1)))
    validator = SchemaValidator(schema)
    kept = validator.filter_by_schema(ents)
    return {
        "ok": True,
        "kept": [_jsonable(row) for row in kept],
        "dropped": [row.get("text") if isinstance(row, dict) else getattr(row, "text", "") for row in rows if str((row or {}).get("label") or (row or {}).get("type") or "") not in schema.concepts],
        "concepts": sorted(schema.concepts),
    }


def run_bootstrap_schema(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not flag("SCHEMA", True):
        return {"ok": False, "error": "FLAG_OFF", "flag": "SCHEMA"}
    args = args or {}
    from stores import read_edge_rows, read_node_rows
    from semantica.ontology.bootstrap_schema import bootstrap_schema

    nodes, _st = read_node_rows(cwd)
    edges = read_edge_rows(cwd)
    entities = args.get("entities") if isinstance(args.get("entities"), list) else [
        {"text": str(row.get("content") or row.get("id") or ""), "type": str(row.get("type") or "Entity")}
        for row in nodes
    ]
    relationships = args.get("relationships") if isinstance(args.get("relationships"), list) else [
        {"source": str(e.get("source") or ""), "target": str(e.get("target") or ""), "type": str(e.get("type") or "related_to")}
        for e in edges
    ]
    try:
        min_occ = int(args.get("min_occurrences") or 1)
    except (TypeError, ValueError):
        min_occ = 1
    packed = bootstrap_schema(entities, relationships, min_occurrences=max(1, min_occ))
    ontology = packed.get("ontology") if isinstance(packed, dict) else None
    return {
        "ok": True,
        "ontology": ontology or packed,
        "ttl": packed.get("ttl") if isinstance(packed, dict) else "",
        "draft": True if not isinstance(packed, dict) else packed.get("draft", True),
        "classes": (ontology or {}).get("classes") if isinstance(ontology, dict) else [],
    }


def run_trust_tiers(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not flag("TIERS", True):
        return {"ok": False, "error": "FLAG_OFF", "flag": "TIERS"}
    args = args or {}
    from semantica.context.tiers import TierCalculator
    try:
        corroboration = int(args.get("corroboration") if args.get("corroboration") is not None else 2)
    except (TypeError, ValueError):
        corroboration = 2
    conf_raw = args.get("confidence")
    try:
        confidence = None if conf_raw is None else float(conf_raw)
    except (TypeError, ValueError):
        confidence = None
    tier = TierCalculator().calculate(corroboration, confidence)
    name = getattr(tier, "name", None) or str(tier)
    return {"ok": True, "tier": str(name), "corroboration": corroboration, "confidence": confidence}


def run_truth_maintenance(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not flag("TMS", True):
        return {"ok": False, "error": "FLAG_OFF", "flag": "TMS"}
    args = args or {}
    from semantica.reasoning.reasoner import Rule, RuleType
    from semantica.reasoning.truth_maintenance import TruthMaintenanceSession
    from semantica.reasoning.truth_maintenance_types import FactSupport

    raw_rules = args.get("rules") if isinstance(args.get("rules"), list) else [
        {"rule_id": "emp", "name": "employee", "conditions": ["Person(?x)"], "conclusion": "Employee(?x)"}
    ]
    rules = []
    for i, row in enumerate(raw_rules):
        if isinstance(row, str):
            rules.append(Rule(rule_id=f"r{i}", name=f"r{i}", conditions=[row], conclusion=row, rule_type=RuleType.IMPLICATION))
            continue
        if not isinstance(row, dict):
            continue
        rules.append(Rule(
            rule_id=str(row.get("rule_id") or f"r{i}"),
            name=str(row.get("name") or row.get("rule_id") or f"r{i}"),
            conditions=list(row.get("conditions") or []),
            conclusion=row.get("conclusion") or "",
            rule_type=RuleType.IMPLICATION,
        ))
    session = TruthMaintenanceSession(rules=rules)
    assertions = []
    for i, fact in enumerate(args.get("facts") or ["Person(张三)"]):
        if isinstance(fact, dict):
            assertions.append(FactSupport(support_id=str(fact.get("id") or f"s{i}"), fact=str(fact.get("fact") or "")))
        else:
            assertions.append(FactSupport(support_id=f"s{i}", fact=str(fact)))
    delta = session.apply(assertions=assertions)
    target = str(args.get("explain") or "Employee(张三)")
    explained = session.explain(target)
    return {
        "ok": True,
        "facts": sorted(session.facts),
        "delta": _jsonable(delta),
        "explain": _jsonable(explained),
        "holds": bool(getattr(explained, "holds", target in session.facts)),
    }


def run_detect_value_conflicts(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    if not flag("CONFLICTS", True):
        return {"ok": False, "error": "FLAG_OFF", "flag": "CONFLICTS"}
    args = args or {}
    from semantica.conflicts.conflict_detector import ConflictDetector
    data = args.get("data") if isinstance(args.get("data"), list) else args.get("entities") or []
    prop = str(args.get("prop") or args.get("property") or "value")
    detector = ConflictDetector()
    found = detector.detect_value_conflicts(data, prop)
    packed = _jsonable(found) or []
    return {"ok": True, "conflicts": packed, "empty": not packed, "property": prop}


FAST_OPS = {
    "semantica_help": run_semantica_help,
    "semantica_capabilities": run_semantica_capabilities,
}

GRAPH_OPS = {
    "community_rag": run_community_rag,
    "schema_gate": run_schema_gate,
    "bootstrap_schema": run_bootstrap_schema,
    "trust_tiers": run_trust_tiers,
    "truth_maintenance": run_truth_maintenance,
    "detect_value_conflicts": run_detect_value_conflicts,
}
