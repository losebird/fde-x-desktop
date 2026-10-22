import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReasonMode } from "../dsh-api";
import { useQueryClient } from "@tanstack/react-query";
import { createJobStore } from "../jobStore";
import { BrainCircuit, Play, RotateCcw, CheckCircle2, AlertCircle, Zap, GitBranch, Info } from "lucide-react";

type ReasonTemplate = { label: string; facts: string; rule: string };

const SKIP_REL = new Set(["出自", "分段", "related_to", "RELATED_TO"]);

const NEUTRAL_FORWARD: ReasonTemplate[] = [
  {
    label: "有这个就有那个",
    facts: "认识(甲, 乙)\n认识(乙, 丙)",
    rule: "如果 认识(甲, 乙) 那么 相关(甲, 乙)",
  },
  {
    label: "两步连上",
    facts: "认识(甲, 乙)\n认识(乙, 丙)",
    rule: "如果 认识(甲, 乙) 并且 认识(乙, 丙) 那么 相关(甲, 丙)",
  },
  {
    label: "同时满足",
    facts: "认识(甲, 乙)\n同类(甲, 丙)",
    rule: "如果 认识(甲, 乙) 并且 同类(甲, 丙) 那么 相关(乙, 丙)",
  },
];

const NEUTRAL_DATALOG: ReasonTemplate[] = [
  {
    label: "一步",
    facts: "边(甲, 乙)\n边(乙, 丙)",
    rule: "相关(X, Y) :- 边(X, Y).",
  },
  {
    label: "连下去",
    facts: "边(甲, 乙)\n边(乙, 丙)",
    rule: "相关(X, Y) :- 边(X, Y).\n相关(X, Y) :- 边(X, Z), 相关(Z, Y).",
  },
  {
    label: "反过来",
    facts: "边(甲, 乙)\n边(乙, 丙)",
    rule: "反向(X, Y) :- 边(Y, X).",
  },
];

function token(raw: string): string {
  const s = String(raw || "").trim();
  if (!s || s.startsWith("session:") || s.startsWith("file:")) return "";
  return s.replace(/[",()]/g, " ").replace(/\s+/g, "").slice(0, 24);
}

function nodeName(row: Record<string, unknown>): string {
  const props = (row.properties && typeof row.properties === "object")
    ? row.properties as Record<string, unknown>
    : {};
  return token(String(
    row.content || props.content || props.label || props.name || row.id || "",
  ));
}

function templatesFromEdges(
  edges: Array<Record<string, unknown>>,
  names: Map<string, string>,
  mode: ReasonMode,
): ReasonTemplate[] {
  const groups = new Map<string, Array<[string, string]>>();
  for (const edge of edges) {
    const rel = token(String(edge.type || edge.edge_type || ""));
    if (!rel || SKIP_REL.has(rel)) continue;
    const srcId = String(edge.source || edge.source_id || "");
    const tgtId = String(edge.target || edge.target_id || "");
    const src = names.get(srcId) || token(srcId);
    const tgt = names.get(tgtId) || token(tgtId);
    if (!src || !tgt || src === tgt) continue;
    const list = groups.get(rel) || [];
    if (list.length < 3 && !list.some((pair) => pair[0] === src && pair[1] === tgt)) {
      list.push([src, tgt]);
      groups.set(rel, list);
    }
  }
  const rels = [...groups.entries()].filter((row) => row[1].length);
  if (!rels.length) return mode === "datalog" ? NEUTRAL_DATALOG : NEUTRAL_FORWARD;
  const out: ReasonTemplate[] = [];
  const [relA, pairsA] = rels[0];
  const factsA = pairsA.map(([a, b]) => `${relA}(${a}, ${b})`).join("\n");
  if (mode === "datalog") {
    out.push({
      label: relA,
      facts: factsA,
      rule: `相关(X, Y) :- ${relA}(X, Y).`,
    });
    if (rels[1]) {
      const [relB, pairsB] = rels[1];
      out.push({
        label: relB,
        facts: pairsB.map(([a, b]) => `${relB}(${a}, ${b})`).join("\n"),
        rule: `相关(X, Y) :- ${relB}(X, Y).`,
      });
    } else {
      out.push({
        label: "连下去",
        facts: factsA,
        rule: `相关(X, Y) :- ${relA}(X, Y).\n相关(X, Y) :- ${relA}(X, Z), 相关(Z, Y).`,
      });
    }
    out.push({
      label: "反过来",
      facts: factsA,
      rule: `反向(X, Y) :- ${relA}(Y, X).`,
    });
    return out.slice(0, 3);
  }
  out.push({
    label: relA,
    facts: factsA,
    rule: `如果 ${relA}(甲, 乙) 那么 相关(甲, 乙)`,
  });
  if (pairsA.length >= 2) {
    const [a1, b1] = pairsA[0];
    const [a2, b2] = pairsA[1];
    out.push({
      label: "两步连上",
      facts: `${relA}(${a1}, ${b1})\n${relA}(${a2}, ${b2})`,
      rule: `如果 ${relA}(甲, 乙) 并且 ${relA}(乙, 丙) 那么 相关(甲, 丙)`,
    });
  }
  if (rels[1]) {
    const [relB, pairsB] = rels[1];
    const [a1, b1] = pairsA[0];
    const [a2, b2] = pairsB[0];
    out.push({
      label: relB,
      facts: `${relA}(${a1}, ${b1})\n${relB}(${a2}, ${b2})`,
      rule: `如果 ${relA}(甲, 乙) 并且 ${relB}(甲, 丙) 那么 相关(乙, 丙)`,
    });
  }
  while (out.length < 3) out.push((mode === "datalog" ? NEUTRAL_DATALOG : NEUTRAL_FORWARD)[out.length]);
  return out.slice(0, 3);
}

async function readGraphTemplates(mode: ReasonMode): Promise<ReasonTemplate[]> {
  try {
    const [edgesRes, nodesRes] = await Promise.all([
      fetch("/api/graph/edges?limit=400"),
      fetch("/api/graph/nodes?limit=400"),
    ]);
    const edgesBody = edgesRes.ok ? await edgesRes.json() : {};
    const nodesBody = nodesRes.ok ? await nodesRes.json() : {};
    const edges = Array.isArray(edgesBody.edges) ? edgesBody.edges : [];
    const nodes = Array.isArray(nodesBody.nodes) ? nodesBody.nodes : [];
    const names = new Map<string, string>();
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const id = String((node as { id?: string }).id || "");
      const name = nodeName(node as Record<string, unknown>);
      if (id && name) names.set(id, name);
    }
    const fromEdges = templatesFromEdges(edges as Array<Record<string, unknown>>, names, mode);
    const classes = nodes
      .filter((node) => node && typeof node === "object" && String((node as { type?: string }).type || "") === "owl:Class")
      .map((node) => nodeName(node as Record<string, unknown>))
      .filter(Boolean)
      .slice(0, 12);
    if (classes.length) {
      const facts = classes.map((name) => `Class(${name})`).join("\n");
      const workbench: ReasonTemplate = mode === "datalog"
        ? { label: "工作台类", facts, rule: "WorkType(X) :- Class(X)." }
        : { label: "工作台类", facts, rule: "如果 Class(甲) 那么 WorkType(甲)" };
      return [workbench, ...fromEdges].slice(0, 4);
    }
    return fromEdges;
  } catch {
    return mode === "datalog" ? NEUTRAL_DATALOG : NEUTRAL_FORWARD;
  }
}

type ReasonJob = {
  facts: string;
  rules: string;
  result: {
    inferred_facts?: string[];
    rules_fired?: number;
    added_edges?: number;
    mutated?: boolean;
  } | null;
  isRunning: boolean;
  error: string;
  applyToGraph: boolean;
};

const reasonJobs = new Map<string, ReturnType<typeof createJobStore<ReasonJob>>>();
const reasonInflight = new Map<string, Promise<void>>();

function reasonStore(mode: string) {
  let store = reasonJobs.get(mode);
  if (!store) {
    const fallback = mode === "datalog" ? NEUTRAL_DATALOG : NEUTRAL_FORWARD;
    store = createJobStore<ReasonJob>({
      facts: fallback[0].facts,
      rules: fallback[0].rule,
      result: null,
      isRunning: false,
      error: "",
      applyToGraph: false,
    });
    reasonJobs.set(mode, store);
  }
  return store;
}

export function ReasoningWorkspace(props: { mode?: ReasonMode }) {
  const mode = props.mode || "forward";
  const isDatalog = mode === "datalog";
  const queryClient = useQueryClient();
  const store = reasonStore(mode);
  const job = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [templates, setTemplates] = useState<ReasonTemplate[]>(
    mode === "datalog" ? NEUTRAL_DATALOG : NEUTRAL_FORWARD,
  );
  const facts = job.facts;
  const rules = job.rules;
  const applyToGraph = job.applyToGraph;
  const result = job.result;
  const isRunning = job.isRunning;
  const error = job.error;
  const setFacts = (value: string) => store.set({ facts: value });
  const setRules = (value: string) => store.set({ rules: value });
  const setApplyToGraph = (value: boolean) => store.set({ applyToGraph: value });
  const setResult = (value: ReasonJob["result"] | ((prev: ReasonJob["result"]) => ReasonJob["result"])) => {
    store.set({ result: typeof value === "function" ? value(store.get().result) : value });
  };
  const setError = (value: string) => store.set({ error: value });

  useEffect(() => {
    let alive = true;
    const fallback = mode === "datalog" ? NEUTRAL_DATALOG : NEUTRAL_FORWARD;
    setTemplates(fallback);
    void readGraphTemplates(mode).then((rows) => {
      if (!alive || !rows.length) return;
      setTemplates(rows);
      const current = store.get();
      if (current.isRunning || current.result) return;
      if (current.facts !== fallback[0].facts || current.rules !== fallback[0].rule) return;
      store.set({ facts: rows[0].facts, rules: rows[0].rule });
    });
    return () => { alive = false; };
  }, [mode, store]);

  useEffect(() => {
    const onRedo = () => {
      setResult(null);
      setError("");
    };
    const onApplied = (event: Event) => {
      const detail = (event as CustomEvent<{ added_edges?: number; mutated?: boolean }>).detail || {};
      setResult((prev) => prev ? { ...prev, mutated: true, added_edges: detail.added_edges ?? prev.added_edges } : prev);
      queryClient.invalidateQueries({ queryKey: ["graph", "full-load"] });
    };
    window.addEventListener("dsh-reason-redo", onRedo);
    window.addEventListener("dsh-reason-applied", onApplied as EventListener);
    return () => {
      window.removeEventListener("dsh-reason-redo", onRedo);
      window.removeEventListener("dsh-reason-applied", onApplied as EventListener);
    };
  }, [queryClient]);

  async function handleRun() {
    if (reasonInflight.has(mode)) return reasonInflight.get(mode);
    store.set({ isRunning: true, error: "", result: null });
    const run = (async () => {
      try {
        const current = store.get();
        const response = await fetch("/api/reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facts: current.facts.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
            rules: current.rules.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
            mode,
            apply_to_graph: false,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || `Status ${response.status}`);
        store.set({
          result: data,
          isRunning: false,
          error: response.status === 207 ? (data.message || "推理只完成一部分。") : "",
        });
        if (data.mutated) queryClient.invalidateQueries({ queryKey: ["graph", "full-load"] });
      } catch (e) {
        store.set({ isRunning: false, error: e instanceof Error ? e.message : "推理没跑成。" });
      } finally {
        reasonInflight.delete(mode);
      }
    })();
    reasonInflight.set(mode, run);
    return run;
  }

  function loadTemplate(t: ReasonTemplate) {
    setFacts(t.facts);
    setRules(t.rule);
    setResult(null);
    setError("");
  }

  function handleReset() {
    const pack = templates[0];
    setFacts(pack.facts);
    setRules(pack.rule);
    setResult(null);
    setError("");
  }

  return (
    <div className="ws-page" style={{ flexDirection: "row" }}>
      {/* ── Left: Input panel ── */}
      <div style={{ width: 480, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--ws-border)", overflow: "hidden", minHeight: 0 }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", display: "grid", placeItems: "center", color: "var(--ws-accent)", flexShrink: 0 }}>
              <BrainCircuit size={16} />
            </div>
            <div>
              <div className="ws-eyebrow" style={{ marginBottom: 2 }}>{isDatalog ? "逻辑规则" : mode === "rete" ? "模式匹配" : "Forward Chaining"}</div>
              <div style={{ color: "var(--ws-text)", fontWeight: 700, fontSize: 15, lineHeight: 1 }}>Inference Engine</div>
            </div>
          </div>
        </div>

        {/* Templates */}
        <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }}>
          <div className="ws-eyebrow" style={{ marginBottom: 8 }}>Quick Templates</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {templates.map((t) => (
              <button key={t.label} className="ws-btn ws-btn--ghost" style={{ padding: "5px 10px", fontSize: 11 }} onClick={() => loadTemplate(t)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="ws-scroll ws-padded" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="ws-label">Facts</label>
            <div className="ws-body" style={{ marginBottom: 8 }}>每行一条事实，写成 <code style={{ color: "var(--ws-accent)", fontSize: 11 }}>predicate(subject, object)</code>。</div>
            <textarea
              className="ws-textarea"
              value={facts}
              onChange={(e) => setFacts(e.target.value)}
              rows={6}
              spellCheck={false}
            />
          </div>

          <div>
            <label className="ws-label">Rules</label>
            <div className="ws-body" style={{ marginBottom: 8 }}>{isDatalog
              ? <>逻辑规则写成 <code style={{ color: "var(--ws-amber)", fontSize: 11 }}>补货(X, Y) :- 售卖(X, Y).</code>，英文谓词也能用</>
              : <>往前推 / 模式匹配写成 <code style={{ color: "var(--ws-amber)", fontSize: 11 }}>如果 … 并且 … 那么 …</code>，英文 IF / AND / THEN 也能用</>}</div>
            <textarea
              className="ws-textarea"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={5}
              spellCheck={false}
            />
          </div>

          {/* Apply toggle */}
          <label className="dsh-reason-write-toggle" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: "var(--ws-radius-sm)", border: "1px solid var(--ws-border)", background: applyToGraph ? "var(--ws-green-soft)" : "var(--ws-surface)" }}>
            <div style={{ position: "relative", width: 36, height: 20, flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={applyToGraph}
                onChange={(e) => setApplyToGraph(e.target.checked)}
                style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer", margin: 0 }}
              />
              <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: applyToGraph ? "var(--ws-green)" : "rgba(255,255,255,0.12)", transition: "background 180ms ease" }} />
              <div style={{ position: "absolute", top: 3, left: applyToGraph ? 19 : 3, width: 14, height: 14, borderRadius: 999, background: "#fff", transition: "left 180ms ease", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: applyToGraph ? "#6ee7b7" : "var(--ws-text-muted)" }}>Write inferred facts to graph</div>
              <div style={{ fontSize: 11, color: "var(--ws-text-dim)" }}>Inferred binary facts are added as edges</div>
            </div>
          </label>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="ws-btn ws-btn--primary"
              onClick={handleRun}
              disabled={isRunning}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {isRunning
                ? <><span className="ws-spin" style={{ display: "inline-block" }}><Zap size={15} /></span>Running…</>
                : <><Play size={14} />Run Reasoning</>}
            </button>
            <button className="ws-btn ws-btn--ghost" onClick={handleReset} title="Reset to defaults">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: Results panel ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ws-text)" }}>Inference Results</div>
          {result && !isRunning && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <span className="ws-pill ws-pill--accent">
                <Zap size={9} /> {result.rules_fired ?? 0} 条规则触发
              </span>
              <span className="ws-pill ws-pill--green">
                <GitBranch size={9} /> {result.added_edges ?? 0} 条边加入
              </span>
              {result.mutated
                ? <span className="ws-pill ws-pill--green">graph updated</span>
                : <span className="ws-pill ws-pill--mono">preview only</span>}
            </div>
          )}
        </div>

        <div className="ws-scroll ws-padded" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error && (
            <div className="ws-animate-in" style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-red-soft)", border: "1px solid rgba(255,123,114,0.28)", color: "#fca5a5", fontSize: 13 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{error}</div>
            </div>
          )}

          {isRunning && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4].map((i) => <div key={i} className="ws-skeleton" style={{ height: 52 }} />)}
            </div>
          )}

          {result && !isRunning && (
            <div className="ws-animate-in">
              {(result.inferred_facts ?? []).length === 0 ? (
                <div className="ws-empty">
                  <div className="ws-empty-icon"><CheckCircle2 size={32} /></div>
                  <div className="ws-empty-title">Reasoning complete</div>
                  <div className="ws-empty-body">No new facts were inferred from the current rule set and facts.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.inferred_facts!.map((fact, i) => (
                    <div key={`${fact}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-surface)", border: "1px solid var(--ws-border)" }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: "var(--ws-green-soft)", border: "1px solid rgba(76,195,138,0.28)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                        <CheckCircle2 size={11} color="var(--ws-green)" />
                      </div>
                      <code style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 12, color: "var(--ws-text)", lineHeight: 1.6, wordBreak: "break-all" }}>{fact}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!result && !isRunning && !error && (
            <div className="ws-empty">
              <div className="ws-empty-icon"><Info size={32} /></div>
              <div className="ws-empty-title">Ready to reason</div>
              <div className="ws-empty-body">Enter facts and rules on the left, then click Run Reasoning to see inferred statements here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
