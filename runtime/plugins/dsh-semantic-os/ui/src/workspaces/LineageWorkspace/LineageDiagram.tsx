/**
 * src/workspaces/LineageWorkspace/LineageDiagram.tsx
 */
import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const THEME_CSS = `
  .react-flow { background: var(--dsw-alias-bg-base, #ffffff); }
  .react-flow__node-group {
    background: var(--dsw-alias-bg-layer-1, #f6f8fa);
    border: 1px dashed var(--dsw-alias-border-l2, rgba(31,35,40,0.22));
    border-radius: 10px;
  }
  .react-flow__node-default {
    background: var(--dsw-alias-bg-layer-1, #f6f8fa);
    color: var(--dsw-alias-label-primary, #1f2328);
    border: 1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15));
    border-radius: 8px;
    padding: 10px 12px;
    white-space: pre-wrap;
    font-size: 12px;
    box-shadow: none;
  }
  .react-flow__controls { background: var(--dsw-alias-bg-layer-1, #f6f8fa); border: 1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15)); border-radius: 10px; }
  .react-flow__controls-button { background: transparent; border-color: var(--dsw-alias-border-l2, rgba(31,35,40,0.15)); color: var(--dsw-alias-label-secondary, #3d444d); }
  .react-flow__controls-button:hover { background: var(--dsw-alias-bg-layer-2, #eef1f4); color: var(--dsw-alias-label-primary, #1f2328); }
`;

export function LineageDiagram() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [searchId, setSearchId] = useState("");
  const [activeId, setActiveId] = useState("");
  const [error, setError] = useState("");
  const [copyNote, setCopyNote] = useState("");

  const copySource = async () => {
    if (!activeId) return;
    try {
      const res = await fetch(`/semantic-os/lineage?id=${encodeURIComponent(activeId)}`);
      const data = await res.json().catch(() => ({} as { ok?: boolean; path?: string; hops?: Array<{ label?: string; id?: string }>; detail?: string }));
      let note = (data && data.detail) || "没有出处可复制。";
      let text = "";
      if (data && data.ok && data.path) {
        note = "路径已复制。";
        text = data.path;
      } else if (data && data.ok && Array.isArray(data.hops) && data.hops.length) {
        note = data.detail || "血缘摘要已复制。";
        text = [data.detail, data.hops.map((hop) => hop.label || hop.id).join(" → ")].filter(Boolean).join(" ");
      }
      setCopyNote(note);
      if (text && navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch {
      setCopyNote("没能复制出处。");
    }
  };

  const downloadReport = async (format: "json" | "markdown") => {
    if (!activeId) return;
    const response = await fetch(`/api/provenance/report?node_id=${encodeURIComponent(activeId)}&format=${format}`);
    if (!response.ok) {
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeId}_provenance.${format === "markdown" ? "md" : "json"}`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  };

  const [prevActiveId, setPrevActiveId] = useState(activeId);
  if (activeId !== prevActiveId) {
    setPrevActiveId(activeId);
    setError("");
    setCopyNote("");
    setNodes([]);
    setEdges([]);
  }

  useEffect(() => {
    let ignore = false;
    if (!activeId) return;

    const xLanes = [
      { id: "group_agent", type: "group", position: { x: 50, y: 50 }, style: { width: 800, height: 120 } },
      { id: "group_activity", type: "group", position: { x: 50, y: 200 }, style: { width: 800, height: 120 } },
      { id: "group_entity", type: "group", position: { x: 50, y: 350 }, style: { width: 800, height: 120 } }
    ];

    const fetchLineage = async () => {
      setError("");
      try {
        const res = await fetch("/api/provenance?node_id=" + encodeURIComponent(activeId));

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`血缘没读成（${res.status}）。`);
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("血缘没读成。");
        }

        const data = await res.json();
        if (res.status === 207) {
          setError(data.message || "血缘只读到一部分。");
        }

        const hops = Array.isArray(data && data.hops) ? data.hops : [];
        const rawNodes = Array.isArray(data && data.nodes)
          ? data.nodes
          : hops.map((hop: { id?: string; label?: string; type?: string; source?: string }, i: number) => ({
              id: String(hop.id || hop.label || `hop-${i}`),
              label: String(hop.label || hop.id || `hop-${i}`),
              prov_type: String(hop.type || hop.source || "entity"),
              parent_id: "group_entity",
            }));
        const rawEdges = Array.isArray(data && data.edges)
          ? data.edges
          : hops.slice(1).map((hop: { id?: string; label?: string; type?: string }, i: number) => ({
              id: `e${i}`,
              source: String(hops[i].id || hops[i].label || `hop-${i}`),
              target: String(hop.id || hop.label || `hop-${i + 1}`),
              label: String(hop.type || ""),
            }));

        const counters: Record<string, number> = { "group_agent": 0, "group_activity": 0, "group_entity": 0 };

        const mappedNodes = rawNodes.map((n: any) => {
          const parent = String(n.parent_id || "group_entity");
          const c = counters[parent] || 0;
          counters[parent] = c + 1;
          return {
            id: String(n.id || n.label || ""),
            data: { label: String(n.label || n.id || "") + "\n(" + String(n.prov_type || "") + ")" },
            position: { x: 50 + c * 180, y: 30 },
            parentId: parent,
            extent: "parent",
            type: "default"
          };
        });

        const mappedEdges = rawEdges.map((e: any, i: number) => ({
          id: String(e.id || `e${i}`),
          source: e.source,
          target: e.target,
          label: e.label,
          animated: true,
          style: { stroke: "#58a6ff" }
        }));

        if (!ignore) {
          setNodes([...xLanes, ...mappedNodes]);
          setEdges(mappedEdges);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "血缘没读成。");
      }
    };
    void fetchLineage();
    return () => { ignore = true; };
  }, [activeId]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "var(--dsw-alias-bg-base, #ffffff)" }}>
      <style>{THEME_CSS}</style>

      {/* Toolbar */}
      <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 10, display: "flex", gap: 8, alignItems: "center", background: "var(--dsw-alias-bg-layer-1, #f6f8fa)", padding: "8px 12px", borderRadius: 12, border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", boxShadow: "none" }}>
        <span className="ws-eyebrow" style={{ color: "var(--ws-accent, #4aa3ff)", marginRight: 4 }}>血缘</span>
        <input
          className="ws-input"
          type="text"
          placeholder="输入节点编号"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setActiveId(searchId); }}
          style={{ width: 200, padding: "6px 10px", fontSize: 12 }}
        />
        <button className="ws-btn ws-btn--primary" style={{ padding: "6px 12px" }} onClick={() => setActiveId(searchId)}>
          追踪
        </button>
        <div style={{ flex: 1 }} />
        <button className="ws-btn ws-btn--ghost" style={{ padding: "6px 12px", fontSize: 11 }} disabled={!activeId} onClick={() => void copySource()}>
          复制出处
        </button>
        {copyNote ? <span data-dsh-lineage-note="1" style={{ fontSize: 12, color: "var(--ws-text)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{copyNote}</span> : null}
        <button className="ws-btn ws-btn--ghost" style={{ padding: "6px 12px", fontSize: 11 }} disabled={!activeId} onClick={() => void downloadReport("json")}>
          导出 JSON
        </button>
        <button className="ws-btn ws-btn--ghost" style={{ padding: "6px 12px", fontSize: 11 }} disabled={!activeId} onClick={() => void downloadReport("markdown")}>
          导出文稿
        </button>
      </div>

      {error ? (
        <div style={{ position: "absolute", top: 60, left: 14, right: 14, zIndex: 10, padding: 12, borderRadius: 14, color: "#d14343", background: "rgba(209,67,67,0.08)", border: "1px solid rgba(209,67,67,0.22)" }}>
          {error}
        </div>
      ) : null}

      {activeId ? (
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="var(--dsw-alias-border-l2, rgba(31,35,40,0.08))" gap={24} />
          <Controls />
        </ReactFlow>
      ) : (
        <div className="ws-empty" style={{ height: "100%", paddingTop: 72 }}>
          <div className="ws-empty-icon"><Link2 size={36} color="var(--ws-accent)" /></div>
          <div className="ws-empty-title">血缘</div>
          <div className="ws-empty-body">上面填节点编号，点追踪，看这条节点的血缘。</div>
        </div>
      )}
    </div>
  );
}
