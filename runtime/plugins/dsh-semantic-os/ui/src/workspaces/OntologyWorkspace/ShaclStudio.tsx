import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { FileCode2, Loader2, Play, Shield, Wand2 } from "lucide-react";
import {
  generateShacl,
  loadOntologyRegistry,
  loadShaclShapes,
  validateShacl,
} from "./api";
import type { OntologyEntry, ShaclShapeSummary, ShaclValidationResponse } from "./types";
import { asRegistry, asShapeList, asViolations } from "./shaclView";
import { createJobStore } from "../../jobStore";

interface ShaclStudioProps {
  onJumpToNode?: (nodeId: string) => void;
}

const shaclJob = createJobStore({
  loading: false,
  error: "",
  validation: null as ShaclValidationResponse | null,
});
let shaclInflight: Promise<void> | null = null;

export function ShaclStudio({ onJumpToNode }: ShaclStudioProps) {
  const [registry, setRegistry] = useState<OntologyEntry[]>([]);
  const [selectedUri, setSelectedUri] = useState("");
  const [shacl, setShacl] = useState("");
  const [fullShacl, setFullShacl] = useState(""); // preserves complete Turtle across shape selections
  const [shapes, setShapes] = useState<ShaclShapeSummary[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const job = useSyncExternalStore(shaclJob.subscribe, shaclJob.get, shaclJob.get);
  const validation = job.validation;
  const loading = job.loading;
  const error = job.error;
  const setValidation = (value: ShaclValidationResponse | null) => shaclJob.set({ validation: value });
  const setLoading = (value: boolean) => shaclJob.set({ loading: value });
  const setError = (value: string) => shaclJob.set({ error: value });

  useEffect(() => {
    let cancelled = false;
    loadOntologyRegistry()
      .then((entries) => {
        if (cancelled) return;
        const rows = asRegistry(entries) as OntologyEntry[];
        setRegistry(rows);
        setSelectedUri((current) => current || rows[0]?.uri || "");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "词表登记没读成。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [prevUri, setPrevUri] = useState(selectedUri);
  if (selectedUri !== prevUri) {
    setPrevUri(selectedUri);
    setShacl("");
    setFullShacl("");
    setSelectedShapeId(null);
    setValidation(null);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    let ignore = false;
    async function fetchShapes() {
      if (!selectedUri) return;
      try {
        const data = await loadShaclShapes(selectedUri);
        if (!ignore) {
          setShapes(asShapeList(data && data.shapes));
          const turtle = String((data && data.shacl_turtle) || "");
          if (data.shapes && data.shapes.length) {
            setFullShacl(turtle);
            setShacl((current) => current || turtle);
          } else {
            setFullShacl("");
            setShacl("");
          }
          setSelectedShapeId(null);
          setValidation(null);
        }
      } catch {
        if (!ignore) setShapes([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void fetchShapes();
    return () => {
      ignore = true;
    };
  }, [selectedUri]);

  const handleGenerate = useCallback(async () => {
    if (!selectedUri || shaclInflight) return shaclInflight;
    setLoading(true);
    setError("");
    shaclInflight = (async () => {
      try {
        const data = await generateShacl(selectedUri, "strict");
        if (!data.shape_count) {
          setFullShacl("");
          setShacl("");
          setShapes([]);
          setSelectedShapeId(null);
          setValidation(null);
          setError("这份分类表没有可生成的填写规则。分类是给人看的词，不是检查表。下一步：去词表改型。");
          return;
        }
        setFullShacl(data.shacl_turtle);
        setShacl(data.shacl_turtle);
        setSelectedShapeId(null);
        const shapeData = await loadShaclShapes(selectedUri);
        setShapes(asShapeList(shapeData && shapeData.shapes));
        setValidation(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "规则没生成成。");
      } finally {
        setLoading(false);
        shaclInflight = null;
      }
    })();
    return shaclInflight;
  }, [selectedUri]);

  const handleSelectShape = useCallback((shapeId: string) => {
    setSelectedShapeId(shapeId);
    // Extract the Turtle block for this shape from the full SHACL so the editor
    // pre-populates with the selected shape's definition.
    const src = fullShacl || shacl;
    const normalised = src.replace(/\r\n/g, "\n");
    // Split on blank lines to isolate statement groups.
    const blocks = normalised.split(/\n{2,}/).filter((b) => b.trim());
    const match = blocks.find((b) => {
      const first = b.trimStart();
      return first.startsWith(shapeId + " ") || first.startsWith(shapeId + "\n") || first.startsWith(shapeId + "\t");
    });
    if (match) {
      setShacl(match.trim());
    }
  }, [fullShacl, shacl]);

  const handleShowAllShapes = useCallback(() => {
    setSelectedShapeId(null);
    setShacl(fullShacl);
  }, [fullShacl]);

  const handleValidate = async () => {
    if (!selectedUri || !shacl.trim() || shaclInflight) return shaclInflight;
    setLoading(true);
    setError("");
    shaclInflight = (async () => {
      try {
        setValidation(await validateShacl(selectedUri, shacl));
      } catch (err) {
        setError(err instanceof Error ? err.message : "规则没检查成。");
      } finally {
        setLoading(false);
        shaclInflight = null;
      }
    })();
    return shaclInflight;
  };

  const groupedShapes = useMemo(() => {
    const groups = new Map<string, ShaclShapeSummary[]>();
    for (const shape of asShapeList(shapes)) {
      const key = shape.target_class || "未指定对象";
      groups.set(key, [...(groups.get(key) || []), shape]);
    }
    return Array.from(groups.entries());
  }, [shapes]);

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={kickerStyle}><Shield size={14} /> 规则检查</div>
          <h2 style={titleStyle}>生成、改和检查填写规则</h2>
          <p style={textStyle}>
            从词表结构生成填写规则，检查有没有填错，违规可以跳回图。
          </p>
        </div>
        <div style={selectorShellStyle}>
          <label style={labelStyle}>词表</label>
          <select style={inputStyle} value={selectedUri} onChange={(event) => setSelectedUri(event.target.value)}>
{!registry.length ? <option value="">没有分类表</option> : null}
            {registry.map((entry) => <option key={entry.uri} value={entry.uri}>{entry.name}</option>)}
          </select>
        </div>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={gridStyle}>
        <section style={cardStyle}>
          <div style={panelHeaderStyle}>
            <h3 style={sectionTitleStyle}>规则形状</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={countBadgeStyle}>{shapes.length} 条规则形状</span>
              {selectedShapeId ? (
                <button style={smallButtonStyle} onClick={handleShowAllShapes}>看全部</button>
              ) : null}
            </div>
          </div>
          <div style={shapeListStyle}>
            {groupedShapes.map(([target, items]) => (
              <div key={target} style={shapeGroupStyle}>
                <div style={shapeTargetStyle}>{target}</div>
                {items.map((shape) => {
                  const isSelected = selectedShapeId === shape.id;
                  return (
                    <button
                      key={shape.id}
                      style={{
                        ...shapeRowStyle,
                        cursor: "pointer",
                        background: isSelected ? "rgba(124,231,211,0.1)" : "var(--dsw-alias-bg-base, #fff)",
                        border: isSelected ? "1px solid var(--dsw-alias-brand-primary, #0969da)" : "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
                        textAlign: "left",
                        width: "100%",
                      }}
                      onClick={() => handleSelectShape(shape.id)}
                      title="点这条，放到右边改"
                    >
                      <FileCode2 size={14} color={isSelected ? "var(--dsw-alias-brand-primary, #0969da)" : "var(--dsw-alias-brand-primary, #0969da)"} />
                      <div>
                        <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontWeight: 800 }}>{shape.id}</div>
                        <div style={mutedStyle}>
                          {shape.constraint_count} 条约束
                          {(shape.constraints || []).length ? ` · ${(shape.constraints || []).join(", ")}` : ""}
                        </div>
                      </div>
                      <span style={violationBadgeStyle}>{shape.violation_count}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {!shapes.length ? <div>
              <p style={mutedStyle}>没有规则形状</p>
              <p style={mutedStyle}>还没有规则形状。分类表有了就点「按结构生成规则」。不会自己编规则。</p>
            </div> : null}
          </div>
        </section>

        <section style={editorShellStyle}>
          <div style={panelHeaderStyle}>
            <h3 style={sectionTitleStyle}>
              {selectedShapeId ? selectedShapeId : "规则编辑"}
            </h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={secondaryButtonStyle} disabled={loading} onClick={handleGenerate}><Wand2 size={14} /> 按结构生成规则</button>
              <button style={primaryButtonStyle} disabled={loading || !shacl.trim()} onClick={handleValidate}>
                {loading ? <Loader2 size={14} className="ws-spin" /> : <Play size={14} />}
                检查
              </button>
            </div>
          </div>
          <div style={editorFrameStyle}>
            <textarea
              value={shacl}
              onChange={(event) => setShacl(event.target.value || "")}
              spellCheck={false}
              style={editorTextStyle}
              placeholder="还没有规则。有分类表后点「按结构生成规则」。"
            />
          </div>
        </section>
      </div>

      <section style={cardStyle}>
        <div style={panelHeaderStyle}>
          <h3 style={sectionTitleStyle}>检查结果</h3>
          {validation ? <span style={validationBadgeStyle(validation.status, validation.conforms)}>{validation.status}{validation.conforms ? " · 符合" : ""}</span> : null}
        </div>
        {validation ? (
          <>
            <p style={textStyle}>{validation.message}</p>
            <div style={shapeListStyle}>
              {asViolations(validation.violations).map((violation, index) => {
                const nodeId = violation.focus_node || violation.node;
                return (
                  <div key={`${violation.node}-${violation.path}-${index}`} style={violationRowStyle}>
                    <div>
                      <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontWeight: 800 }}>{violation.message}</div>
                      <div style={mutedStyle}>{violation.severity} {violation.path ? `· ${violation.path}` : ""}</div>
                      {nodeId ? <div style={monoStyle}>{nodeId}</div> : null}
                    </div>
                    {nodeId ? (
                      <button style={smallButtonStyle} onClick={() => onJumpToNode?.(nodeId)}>
                        跳到节点
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {!asViolations(validation.violations).length ? <p style={mutedStyle}>没有查出违规。</p> : null}
            </div>
          </>
        ) : (
          <p style={mutedStyle}>还没有规则形状。先有分类表，再点「按结构生成规则」。不会自己编规则。</p>
        )}
      </section>
    </div>
  );
}

function validationBadgeStyle(status: string, conforms: boolean): CSSProperties {
  const color = status === "unavailable" ? "#f2b66d" : conforms ? "var(--dsw-alias-brand-primary, #0969da)" : "#ff9daf";
  return { color, border: `1px solid ${color}35`, background: `${color}14`, borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 900, textTransform: "uppercase" };
}

const pageStyle: CSSProperties = { height: "100%", overflow: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 16 };
const heroStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, padding: 22, border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 22, background: "var(--dsw-alias-bg-layer-1, #f6f8fa)" };
const kickerStyle: CSSProperties = { display: "inline-flex", gap: 8, alignItems: "center", color: "var(--dsw-alias-brand-primary, #0969da)", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" };
const titleStyle: CSSProperties = { margin: "8px 0", color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 26, letterSpacing: "-0.04em" };
const textStyle: CSSProperties = { margin: 0, color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", lineHeight: 1.6, maxWidth: 680 };
const selectorShellStyle: CSSProperties = { minWidth: 320 };
const labelStyle: CSSProperties = { display: "block", color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 11, fontWeight: 800, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" };
const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 12, padding: "10px 12px", background: "var(--dsw-alias-bg-base, #fff)", color: "var(--dsw-alias-label-primary, #1f2328)" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", gap: 16, minHeight: 560 };
const cardStyle: CSSProperties = { padding: 18, border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 20, background: "var(--dsw-alias-bg-layer-1, #f6f8fa)" };
const editorShellStyle: CSSProperties = { ...cardStyle, display: "flex", flexDirection: "column", minHeight: 560 };
const panelHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 };
const sectionTitleStyle: CSSProperties = { margin: 0, color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 16 };
const countBadgeStyle: CSSProperties = { color: "var(--dsw-alias-brand-primary, #0969da)", border: "1px solid rgba(158,232,215,0.2)", borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 900 };
const shapeListStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const shapeGroupStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const shapeTargetStyle: CSSProperties = { color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" };
const shapeRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "18px 1fr auto", gap: 10, padding: 10, borderRadius: 14, background: "var(--dsw-alias-bg-base, #fff)", border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))" };
const violationBadgeStyle: CSSProperties = { color: "#f2b66d", fontWeight: 900 };
const editorFrameStyle: CSSProperties = { flex: 1, minHeight: 0, border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 16, overflow: "hidden" };
const editorTextStyle: CSSProperties = { width: "100%", height: "100%", minHeight: 360, boxSizing: "border-box", border: "none", resize: "none", padding: 12, background: "var(--dsw-alias-bg-base, #fff)", color: "var(--dsw-alias-label-primary, #1f2328)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 13, lineHeight: 1.5 };
const primaryButtonStyle: CSSProperties = { border: "1px solid var(--dsw-alias-brand-primary, #0969da)", borderRadius: 12, padding: "9px 11px", background: "var(--dsw-alias-brand-primary, #0969da)", color: "var(--dsw-alias-fg-on-emphasis, #fff)", fontWeight: 900, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 };
const secondaryButtonStyle: CSSProperties = { ...primaryButtonStyle, background: "var(--dsw-alias-bg-base, #fff)", color: "var(--dsw-alias-label-primary, #1f2328)", borderColor: "var(--dsw-alias-border-l2, rgba(31,35,40,0.15))" };
const violationRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: 12, borderRadius: 14, background: "var(--dsw-alias-bg-base, #fff)", border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))" };
const smallButtonStyle: CSSProperties = { border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", borderRadius: 10, padding: "7px 9px", background: "var(--dsw-alias-bg-base, #fff)", color: "var(--dsw-alias-label-primary, #1f2328)", cursor: "pointer", fontWeight: 800 };
const monoStyle: CSSProperties = { marginTop: 4, color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 11, fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" };
const mutedStyle: CSSProperties = { margin: 0, color: "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))", fontSize: 12, lineHeight: 1.5 };
const errorStyle: CSSProperties = { padding: 12, borderRadius: 14, color: "#9a1f2e", background: "#ffe8eb", border: "1px solid #ffb4c2" };
