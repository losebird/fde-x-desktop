import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { GitMerge, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  loadAlignments,
  loadOntologyRegistry,
  removeAlignment,
  saveAlignment,
  suggestAlignments,
} from "./api";
import type { AlignmentRelation, AlignmentSuggestion, OntologyAlignment, OntologyEntry } from "./types";

const RELATIONS: AlignmentRelation[] = [
  "owl:equivalentClass",
  "owl:equivalentProperty",
  "skos:exactMatch",
  "skos:closeMatch",
  "skos:broadMatch",
  "skos:narrowMatch",
  "skos:relatedMatch",
];

const RELATION_COLORS: Record<AlignmentRelation, string> = {
  "owl:equivalentClass": "var(--dsw-alias-brand-primary, #0969da)",
  "owl:equivalentProperty": "var(--dsw-alias-brand-primary, #0969da)",
  "skos:exactMatch": "var(--dsw-alias-brand-primary, #0969da)",
  "skos:closeMatch": "#58a6ff",
  "skos:broadMatch": "#f2b66d",
  "skos:narrowMatch": "#f2b66d",
  "skos:relatedMatch": "#d2a8ff",
};

export function AlignmentsTab() {
  const [registry, setRegistry] = useState<OntologyEntry[]>([]);
  const [alignments, setAlignments] = useState<OntologyAlignment[]>([]);
  const [suggestions, setSuggestions] = useState<AlignmentSuggestion[]>([]);
  const [sourceOntology, setSourceOntology] = useState("");
  const [targetOntology, setTargetOntology] = useState("");
  const [sourceUri, setSourceUri] = useState("");
  const [targetUri, setTargetUri] = useState("");
  const [relation, setRelation] = useState<AlignmentRelation>("skos:exactMatch");
  const [confidence, setConfidence] = useState(0.86);
  const [provenance, setProvenance] = useState("");
  const [source, setSource] = useState("词表");
  const [reviewer, setReviewer] = useState("");
  const [threshold, setThreshold] = useState(0.68);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const [registryResult, alignmentResult] = await Promise.allSettled([
      loadOntologyRegistry(),
      loadAlignments(),
    ]);

    const errors: string[] = [];
    if (registryResult.status === "fulfilled") {
      setRegistry(registryResult.value);
      setSourceOntology((current) => current || registryResult.value[0]?.uri || "");
      setTargetOntology((current) => current || registryResult.value[1]?.uri || registryResult.value[0]?.uri || "");
    } else {
      errors.push(registryResult.reason instanceof Error ? registryResult.reason.message : "词表列表没读成。");
    }
    if (alignmentResult.status === "fulfilled") {
      setAlignments(alignmentResult.value);
    } else {
      errors.push(alignmentResult.reason instanceof Error ? alignmentResult.reason.message : "对齐没读成。");
    }
    if (errors.length) setError(errors.join(" "));
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchInitial() {
      const [registryResult, alignmentResult] = await Promise.allSettled([
        loadOntologyRegistry(),
        loadAlignments(),
      ]);
      if (ignore) return;

      const errors: string[] = [];
      if (registryResult.status === "fulfilled") {
        setRegistry(registryResult.value);
        setSourceOntology((current) => current || registryResult.value[0]?.uri || "");
        setTargetOntology((current) => current || registryResult.value[1]?.uri || registryResult.value[0]?.uri || "");
      } else {
        errors.push(registryResult.reason instanceof Error ? registryResult.reason.message : "词表列表没读成。");
      }
      if (alignmentResult.status === "fulfilled") {
        setAlignments(alignmentResult.value);
      } else {
        errors.push(alignmentResult.reason instanceof Error ? alignmentResult.reason.message : "对齐没读成。");
      }
      if (errors.length) setError(errors.join(" "));
    }
    void fetchInitial();
    return () => { ignore = true; };
  }, []);

  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of alignments) {
      counts.set(item.relation, (counts.get(item.relation) ?? 0) + 1);
    }
    return counts;
  }, [alignments]);

  // Pairwise matrix: group alignments by (source_ontology, target_ontology) pair.
  const matrix = useMemo(() => {
    function ontologyOfUri(uri: string): string {
      for (const entry of registry) {
        if (uri === entry.uri || uri.startsWith(entry.uri + "#") || uri.startsWith(entry.uri + "/")) {
          return entry.uri;
        }
      }
      const hashIdx = uri.lastIndexOf("#");
      if (hashIdx > 0) return uri.substring(0, hashIdx);
      const slashIdx = uri.lastIndexOf("/");
      return slashIdx > 0 ? uri.substring(0, slashIdx) : uri;
    }
    const cells: Map<string, OntologyAlignment[]> = new Map();
    for (const alignment of alignments) {
      const key = `${ontologyOfUri(alignment.source_uri)}|||${ontologyOfUri(alignment.target_uri)}`;
      const bucket = cells.get(key) ?? [];
      bucket.push(alignment);
      cells.set(key, bucket);
    }
    return { ontologies: registry, cells };
  }, [registry, alignments]);

  const handleSave = useCallback(async () => {
    if (!sourceUri.trim() || !targetUri.trim()) {
      setError("Provide both source and target entity URIs.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveAlignment({
        source_uri: sourceUri.trim(),
        target_uri: targetUri.trim(),
        relation,
        confidence,
        provenance: provenance || undefined,
        source: source || undefined,
        reviewer: reviewer || undefined,
      });
      setSourceUri("");
      setTargetUri("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save alignment.");
    } finally {
      setBusy(false);
    }
  }, [sourceUri, targetUri, relation, confidence, provenance, source, reviewer, reload]);

  const handleSuggest = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await suggestAlignments({
        source_ontology_uri: sourceOntology || undefined,
        target_ontology_uri: targetOntology || undefined,
        threshold,
        limit: 40,
      });
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest alignments.");
    } finally {
      setBusy(false);
    }
  }, [sourceOntology, targetOntology, threshold]);

  const handleAcceptSuggestion = useCallback((suggestion: AlignmentSuggestion) => {
    setSourceUri(suggestion.source_uri);
    setTargetUri(suggestion.target_uri);
    setRelation(suggestion.relation);
    setConfidence(Math.max(0.1, Math.min(1, suggestion.score)));
    setProvenance(suggestion.reason);
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await removeAlignment(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove alignment.");
    } finally {
      setBusy(false);
    }
  }, [reload]);

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={kickerStyle}><GitMerge size={14} /> 对齐矩阵</div>
          <h2 style={titleStyle}>两套词表怎么对应</h2>
          <p style={textStyle}>
            管理等价和对上号关系，带把握、出处、审核人和按标签给的建议。
          </p>
        </div>
        <div style={summaryGridStyle}>
          <Metric label="对应" value={alignments.length} />
          <Metric label="关系" value={relationCounts.size} />
          <Metric label="建议" value={suggestions.length} />
        </div>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={ephemeralBannerStyle}>
        对齐只存在引擎内存里，重启就没了。要留下就导出图或词表。
      </div>

      {matrix.ontologies.length >= 2 ? (
        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>两两对齐矩阵</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={matrixTableStyle}>
              <thead>
                <tr>
                  <th style={matrixCornerStyle} />
                  {matrix.ontologies.map((col) => (
                    <th key={col.uri} style={matrixColHeaderStyle}>{col.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.ontologies.map((row) => (
                  <tr key={row.uri}>
                    <td style={matrixRowHeaderStyle}>{row.name}</td>
                    {matrix.ontologies.map((col) => {
                      const key = `${row.uri}|||${col.uri}`;
                      const cellItems = matrix.cells.get(key) ?? [];
                      const isDiag = row.uri === col.uri;
                      return (
                        <td key={col.uri} style={{ ...matrixCellStyle, background: isDiag ? "rgba(255,255,255,0.015)" : undefined }}>
                          {isDiag ? <span style={mutedStyle}>—</span> : cellItems.length ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {cellItems.map((item) => (
                                <span
                                  key={item.id}
                                  style={{ ...relationBadgeStyle, color: RELATION_COLORS[item.relation], borderColor: `${RELATION_COLORS[item.relation]}44`, cursor: "pointer", fontSize: 9 }}
                                  title={`${item.source_label} → ${item.target_label} (${Math.round(item.confidence * 100)}%)`}
                                  onClick={() => {
                                    setSourceUri(item.source_uri);
                                    setTargetUri(item.target_uri);
                                    setRelation(item.relation);
                                    setConfidence(item.confidence);
                                    setProvenance(item.provenance ?? "");
                                  }}
                                >
                                  {item.relation.split(":")[1]}
                                </span>
                              ))}
                            </div>
                          ) : <span style={{ color: "rgba(127,208,255,0.15)", fontSize: 12 }}>·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...mutedStyle, marginTop: 10 }}>点关系徽章，会填到下面的编辑器。</p>
        </section>
      ) : null}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>新建或更新对齐</h3>
          <label style={labelStyle}>源实体地址</label>
          <input style={inputStyle} value={sourceUri} onChange={(event) => setSourceUri(event.target.value)} />
          <label style={labelStyle}>目标实体地址</label>
          <input style={inputStyle} value={targetUri} onChange={(event) => setTargetUri(event.target.value)} />
          <div style={twoColStyle}>
            <div>
              <label style={labelStyle}>关系</label>
              <select style={inputStyle} value={relation} onChange={(event) => setRelation(event.target.value as AlignmentRelation)}>
                {RELATIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>把握 {confidence.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={confidence}
                onChange={(event) => setConfidence(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <label style={labelStyle}>出处说明</label>
          <textarea style={{ ...inputStyle, minHeight: 74, resize: "vertical" }} value={provenance} onChange={(event) => setProvenance(event.target.value)} />
          <div style={twoColStyle}>
            <div>
              <label style={labelStyle}>来源</label>
              <input style={inputStyle} value={source} onChange={(event) => setSource(event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>审核人</label>
              <input style={inputStyle} value={reviewer} onChange={(event) => setReviewer(event.target.value)} />
            </div>
          </div>
          <button style={primaryButtonStyle} disabled={busy} onClick={handleSave}>
            {busy ? <Loader2 size={14} className="ws-spin" /> : <GitMerge size={14} />}
            保存对齐
          </button>
        </section>

        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>建议对齐</h3>
          <div style={twoColStyle}>
            <div>
              <label style={labelStyle}>源词表</label>
              <select style={inputStyle} value={sourceOntology} onChange={(event) => setSourceOntology(event.target.value)}>
                <option value="">任意词表</option>
                {registry.map((entry) => <option key={entry.uri} value={entry.uri}>{entry.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>目标词表</label>
              <select style={inputStyle} value={targetOntology} onChange={(event) => setTargetOntology(event.target.value)}>
                <option value="">任意词表</option>
                {registry.map((entry) => <option key={entry.uri} value={entry.uri}>{entry.name}</option>)}
              </select>
            </div>
          </div>
          <label style={labelStyle}>相似度阈值 {threshold.toFixed(2)}</label>
          <input
            type="range"
            min="0.25"
            max="0.95"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
            style={{ width: "100%" }}
          />
          <button style={secondaryButtonStyle} disabled={busy} onClick={handleSuggest}>
            <Sparkles size={14} />
            建议对齐
          </button>
          <div style={suggestionListStyle}>
            {suggestions.map((item) => (
              <button key={`${item.source_uri}-${item.target_uri}-${item.relation}`} style={suggestionStyle} onClick={() => handleAcceptSuggestion(item)}>
                <span style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontWeight: 800 }}>{item.source_label}</span>
                <span style={{ color: RELATION_COLORS[item.relation] }}>{item.relation}</span>
                <span style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontWeight: 800 }}>{item.target_label}</span>
                <span style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))" }}>{Math.round(item.score * 100)}%</span>
              </button>
            ))}
            {!suggestions.length ? <p style={mutedStyle}>点「建议对齐」看候选对应。</p> : null}
          </div>
        </section>
      </div>

      <section style={cardStyle}>
        <h3 style={sectionTitleStyle}>已记录的对齐</h3>
        <div style={tableStyle}>
          {alignments.map((item) => (
            <div key={item.id} style={rowStyle}>
              <div>
                <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontWeight: 800 }}>{item.source_label || item.source_uri}</div>
                <div style={monoStyle}>{item.source_uri}</div>
              </div>
              <div style={{ ...relationBadgeStyle, color: RELATION_COLORS[item.relation], borderColor: `${RELATION_COLORS[item.relation]}55` }}>
                {item.relation}
              </div>
              <div>
                <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontWeight: 800 }}>{item.target_label || item.target_uri}</div>
                <div style={monoStyle}>{item.target_uri}</div>
              </div>
              <div style={confidenceStyle}>{Math.round(item.confidence * 100)}%</div>
              <button style={iconButtonStyle} disabled={busy} onClick={() => handleRemove(item.id)} title="删除对齐">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!alignments.length ? <p style={mutedStyle}>还没有对齐记录。</p> : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <span style={{ color: "var(--dsw-alias-brand-primary, #0969da)", fontSize: 20, fontWeight: 900 }}>{value.toLocaleString()}</span>
      <span style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 11 }}>{label}</span>
    </div>
  );
}

const pageStyle: CSSProperties = { height: "100%", overflow: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 16 };
const heroStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, padding: 22, border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 22, background: "var(--dsw-alias-bg-layer-1, #f6f8fa)" };
const kickerStyle: CSSProperties = { display: "inline-flex", gap: 8, alignItems: "center", color: "var(--dsw-alias-brand-primary, #0969da)", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { margin: "8px 0", color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 26, letterSpacing: "-0.04em" };
const textStyle: CSSProperties = { margin: 0, color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", lineHeight: 1.6, maxWidth: 620 };
const summaryGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(100px, 1fr))", gap: 10, minWidth: 320 };
const metricStyle: CSSProperties = { padding: 14, borderRadius: 16, background: "var(--dsw-alias-bg-base, #fff)", border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", display: "flex", flexDirection: "column", gap: 4 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(320px, 0.9fr) minmax(360px, 1.1fr)", gap: 16 };
const cardStyle: CSSProperties = { padding: 18, border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 20, background: "var(--dsw-alias-bg-layer-1, #f6f8fa)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" };
const sectionTitleStyle: CSSProperties = { margin: "0 0 14px", color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 16 };
const labelStyle: CSSProperties = { display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 11, fontWeight: 800, margin: "10px 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 12, padding: "10px 12px", background: "var(--dsw-alias-bg-base, #fff)", color: "var(--dsw-alias-label-primary, #1f2328)" };
const twoColStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const primaryButtonStyle: CSSProperties = { marginTop: 14, width: "100%", border: "1px solid var(--dsw-alias-brand-primary, #0969da)", borderRadius: 12, padding: "11px 13px", background: "var(--dsw-alias-brand-primary, #0969da)", color: "var(--dsw-alias-label-primary, #1f2328)", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };
const secondaryButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "var(--dsw-alias-bg-base, #fff)", borderColor: "rgba(127,208,255,0.18)" };
const suggestionListStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, marginTop: 14, maxHeight: 260, overflow: "auto" };
const suggestionStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 10, alignItems: "center", textAlign: "left", border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 12, background: "var(--dsw-alias-bg-base, #fff)", padding: 10, cursor: "pointer" };
const tableStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const rowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto 1fr auto auto", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, background: "var(--dsw-alias-bg-base, #fff)", border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))" };
const monoStyle: CSSProperties = { color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 11, fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" };
const relationBadgeStyle: CSSProperties = { padding: "5px 9px", border: "1px solid", borderRadius: 999, fontSize: 10, fontWeight: 900 };
const confidenceStyle: CSSProperties = { color: "#f2b66d", fontWeight: 900 };
const iconButtonStyle: CSSProperties = { width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,157,175,0.18)", background: "rgba(255,157,175,0.08)", color: "#ff9daf", cursor: "pointer" };
const mutedStyle: CSSProperties = { margin: 0, color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 13 };
const errorStyle: CSSProperties = { padding: 12, borderRadius: 14, color: "#ffb4c2", background: "rgba(255,157,175,0.1)", border: "1px solid rgba(255,157,175,0.18)" };
const ephemeralBannerStyle: CSSProperties = { padding: "9px 14px", borderRadius: 12, color: "#f2b66d", background: "rgba(242,182,109,0.08)", border: "1px solid rgba(242,182,109,0.22)", fontSize: 12 };
const matrixTableStyle: CSSProperties = { borderCollapse: "collapse", minWidth: "100%", fontSize: 12 };
const matrixCornerStyle: CSSProperties = { padding: "8px 12px", borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))" };
const matrixColHeaderStyle: CSSProperties = { padding: "8px 12px", color: "var(--dsw-alias-brand-primary, #0969da)", fontWeight: 900, borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", textAlign: "center", whiteSpace: "nowrap" };
const matrixRowHeaderStyle: CSSProperties = { padding: "8px 12px", color: "var(--dsw-alias-brand-primary, #0969da)", fontWeight: 900, borderRight: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", whiteSpace: "nowrap" };
const matrixCellStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid rgba(127,208,255,0.06)", borderRight: "1px solid rgba(127,208,255,0.06)", textAlign: "center", verticalAlign: "middle", minWidth: 100 };
