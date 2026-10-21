/**
 * src/workspaces/EnrichWorkspace/EntityResolutionTab.tsx
 *
 * 实体消歧 — run duplicate detection, review flagged pairs,
 * perform one-click merges, and view merge history from the Registry.
 */
import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { ScanSearch, GitMerge, X, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { logEvent, useRegistry } from "../../store/registryStore";

interface DedupPair {
  a: { id: string; label: string; type: string };
  b: { id: string; label: string; type: string };
  score: number;
  dismissed?: boolean;
}

interface RawDuplicateItem {
  entity_a?: string | Record<string, unknown>;
  entity_b?: string | Record<string, unknown>;
  similarity?: number;
  score?: number;
  [key: string]: unknown;
}

function extractId(entity: string | Record<string, unknown> | undefined): string {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  return String(entity.id ?? entity.text ?? JSON.stringify(entity));
}

function extractLabel(entity: string | Record<string, unknown> | undefined): string {
  if (!entity) return "";
  if (typeof entity === "string") return entity;
  return String(entity.text ?? entity.label ?? entity.content ?? entity.id ?? "");
}

function extractType(entity: string | Record<string, unknown> | undefined): string {
  if (!entity || typeof entity === "string") return "entity";
  return String(entity.type ?? "entity");
}

type DedupJob = {
  scanning: boolean;
  pairs: DedupPair[];
  scanError: string;
  threshold: number;
};

const EMPTY_JOB: DedupJob = { scanning: false, pairs: [], scanError: "", threshold: 0.82 };
const dedupJobs = new Map<string, DedupJob>();
const dedupListeners = new Set<() => void>();
let dedupCwd = "";
const inflight = new Map<string, Promise<void>>();

function emitDedup() {
  dedupListeners.forEach((fn) => fn());
}

export function setEntityResolutionCwd(cwd: string) {
  dedupCwd = String(cwd || "");
}

function jobKey() {
  return dedupCwd || "default";
}

function readJob(key = jobKey()): DedupJob {
  return dedupJobs.get(key) || EMPTY_JOB;
}

function writeJob(patch: Partial<DedupJob>, key = jobKey()) {
  const prev = readJob(key);
  dedupJobs.set(key, { ...prev, ...patch });
  emitDedup();
}

function subscribeDedup(fn: () => void) {
  dedupListeners.add(fn);
  return () => { dedupListeners.delete(fn); };
}

function parseDuplicates(raw: RawDuplicateItem[]): DedupPair[] {
  return raw.map((item) => ({
    a: {
      id: extractId(item.entity_a as string | Record<string, unknown>),
      label: extractLabel(item.entity_a as string | Record<string, unknown>),
      type: extractType(item.entity_a as string | Record<string, unknown>),
    },
    b: {
      id: extractId(item.entity_b as string | Record<string, unknown>),
      label: extractLabel(item.entity_b as string | Record<string, unknown>),
      type: extractType(item.entity_b as string | Record<string, unknown>),
    },
    score: Number(item.similarity ?? item.score ?? 0),
  }));
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.round(score * 100));
  const color = score >= 0.9 ? "#ff7b72" : score >= 0.75 ? "#f2b66d" : "#4cc38a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--dsw-alias-bg-layer-2, #eef1f4)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 300ms ease" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 34, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

function PairRow({
  pair,
  onMerge,
  onDismiss,
}: {
  pair: DedupPair;
  onMerge: (primaryId: string, duplicateId: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    setMerging(true);
    await onMerge(pair.a.id, pair.b.id);
    setMerging(false);
  };

  return (
    <div style={pairCardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Expand */}
        <button onClick={() => setExpanded((v) => !v)} style={iconBtnStyle}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* Entity Labels */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={entityChipStyle}>{pair.a.label || pair.a.id}</span>
            <span style={{ color: "var(--dsw-alias-brand-primary, #0969da)", fontSize: 12, fontWeight: 700 }}>≈</span>
            <span style={entityChipStyle}>{pair.b.label || pair.b.id}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <ScoreBar score={pair.score} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => void handleMerge()}
            disabled={merging}
            style={{
              ...actionBtnStyle,
              background: "rgba(76,195,138,0.12)",
              border: "1px solid rgba(76,195,138,0.28)",
              color: "#4cc38a",
            }}
          >
            {merging ? <Loader2 size={12} className="animate-spin" /> : <GitMerge size={12} />}
            <span>合并</span>
          </button>
          <button onClick={onDismiss} style={iconBtnStyle} title="忽略">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Expanded diff */}
      {expanded ? (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "主记录（保留）", entity: pair.a, accentColor: "var(--dsw-alias-brand-primary, #0969da)" },
            { label: "重复（删除）", entity: pair.b, accentColor: "#d14343" },
          ].map(({ label, entity, accentColor }) => (
            <div key={entity.id} style={{ ...diffCardStyle, borderColor: `${accentColor}33` }}>
              <div style={{ color: accentColor, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 13, fontWeight: 600 }}>{entity.label || entity.id}</div>
              <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 11, marginTop: 3 }}>{entity.type}</div>
              <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 10, marginTop: 4, fontFamily: "monospace" }}>{entity.id}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EntityResolutionTab() {
  const job = useSyncExternalStore(subscribeDedup, readJob, readJob);
  const [threshold, setThreshold] = useState(job.threshold || 0.82);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [manualMsg, setManualMsg] = useState("");
  const scanning = job.scanning;
  const pairs = job.pairs;
  const scanError = job.scanError;
  const registryEntries = useRegistry();

  const mergeHistory = registryEntries.filter((e) => e.op === "merge");

  useEffect(() => {
    if (job.threshold && Math.abs(job.threshold - threshold) > 0.001 && !job.scanning) {
      setThreshold(job.threshold);
    }
  }, [job.threshold, job.scanning, threshold]);

  const handleScan = useCallback(async () => {
    const key = jobKey();
    if (inflight.has(key)) return inflight.get(key);
    writeJob({ scanning: true, scanError: "", threshold });
    const run = (async () => {
      try {
        const res = await fetch("/api/enrich/dedup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threshold }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as Record<string, string>).detail ?? `扫描没跑成（${res.status}）`);
        }
        const data = await res.json();
        const rawDuplicates: RawDuplicateItem[] = Array.isArray(data.duplicates)
          ? (data.duplicates as RawDuplicateItem[])
          : [];
        const parsed = parseDuplicates(rawDuplicates);
        writeJob({ scanning: false, pairs: parsed, scanError: "", threshold }, key);
        logEvent("import", `Dedup scan found ${parsed.length} flagged pair${parsed.length !== 1 ? "s" : ""} (threshold ${threshold.toFixed(2)})`, {
          threshold,
          flagged: parsed.length,
        });
      } catch (err) {
        writeJob({ scanning: false, scanError: err instanceof Error ? err.message : "扫描没跑成。" }, key);
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, run);
    return run;
  }, [threshold]);

  const handleMerge = useCallback(async (primaryId: string, duplicateId: string) => {
    const key = jobKey();
    writeJob({ scanError: "" }, key);
    try {
      const res = await fetch("/api/enrich/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_id: primaryId, duplicate_ids: [duplicateId] }),
      });
      if (!res.ok) throw new Error(`合并没写成（${res.status}）`);
      const data = await res.json();
      if (res.status === 207) {
        writeJob({ scanError: data.message || "合并只完成一部分。" }, key);
      }
      logEvent("merge", `Merged ${duplicateId} → ${primaryId} · ${data.edges_updated ?? 0} edges redirected`, {
        primary: primaryId,
        duplicate: duplicateId,
        edgesUpdated: data.edges_updated,
      });
      const prev = readJob(key);
      writeJob({ pairs: prev.pairs.filter((p) => !(p.a.id === primaryId && p.b.id === duplicateId)) }, key);
    } catch (err) {
      writeJob({ scanError: err instanceof Error ? err.message : "合并没写成。" }, key);
    }
  }, []);

  const handleDismiss = useCallback((index: number) => {
    const key = jobKey();
    const prev = readJob(key);
    writeJob({ pairs: prev.pairs.filter((_, i) => i !== index) }, key);
  }, []);

  return (
    <div style={shellStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ScanSearch size={18} color="#f2b66d" />
          <div>
            <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 16, fontWeight: 700 }}>实体消歧</div>
            <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12 }}>检测并合并图里的重复实体。</div>
          </div>
        </div>
      </div>

      {/* Scan controls */}
      <div style={controlsCardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 12, fontWeight: 600 }}>相似度阈值</label>
              <span style={{ color: "var(--dsw-alias-brand-primary, #0969da)", fontSize: 12, fontWeight: 700 }}>{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#f2b66d", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 10, marginTop: 2 }}>
              <span>更多结果（0.50）</span>
              <span>更少、更有把握（0.99）</span>
            </div>
          </div>
          <button
            onClick={() => void handleScan()}
            disabled={scanning}
            style={scanBtnStyle}
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
            <span>{scanning ? "扫描中…" : "运行去重扫描"}</span>
          </button>
        </div>
        {scanError ? (
          <div style={{ color: "#ff7b72", fontSize: 12, marginTop: 8 }}>{scanError}</div>
        ) : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
          <input className="dsos-input" style={{ flex: 1, minWidth: 140 }} placeholder="第一个 id" value={leftId} onChange={(e) => setLeftId(e.target.value)} />
          <input className="dsos-input" style={{ flex: 1, minWidth: 140 }} placeholder="第二个 id" value={rightId} onChange={(e) => setRightId(e.target.value)} />
          <button type="button" style={actionBtnStyle} onClick={() => {
            if (!leftId.trim() || !rightId.trim()) { setManualMsg("请手填两个 id"); return; }
            if (leftId.trim() === rightId.trim()) { setManualMsg("两个 id 不能相同"); return; }
            setManualMsg("已接受：这两条先分开留着，没有合并");
          }}>接受</button>
          <button type="button" style={actionBtnStyle} onClick={() => {
            if (!leftId.trim() || !rightId.trim()) { setManualMsg("请手填两个 id"); return; }
            setManualMsg("已拒绝：不当成一对，没有合并");
          }}>拒绝</button>
          <button type="button" style={{ ...actionBtnStyle, background: "var(--dsw-alias-brand-primary, #0969da)", color: "#fff", border: 0 }} onClick={() => {
            if (!leftId.trim() || !rightId.trim()) { setManualMsg("请手填两个 id"); return; }
            if (leftId.trim() === rightId.trim()) { setManualMsg("两个 id 不能相同"); return; }
            if (!window.confirm("合并不可撤销。确定把这两个实体合成一条？")) { setManualMsg("没有合并"); return; }
            void handleMerge(leftId.trim(), rightId.trim());
            setManualMsg("已提交合并");
          }}>合并</button>
        </div>
        {manualMsg ? <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12, marginTop: 8 }}>{manualMsg}</div> : null}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", gap: 0 }}>
        {/* Flagged pairs */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {pairs.length > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12, fontWeight: 600 }}>
                  {pairs.length} 对标记
                </div>
                <button onClick={() => setPairs([])} style={clearAllBtnStyle}>全部清除</button>
              </div>
              {pairs.map((pair, index) => (
                <PairRow
                  key={`${pair.a.id}:${pair.b.id}`}
                  pair={pair}
                  onMerge={handleMerge}
                  onDismiss={() => handleDismiss(index)}
                />
              ))}
            </>
          ) : (
            <div style={emptyStateStyle}>
              <ScanSearch size={36} color="var(--dsw-alias-border-l2, rgba(31,35,40,0.25))" />
              <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 14, marginTop: 12, fontWeight: 500 }}>
                没有标记对
              </div>
              <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12, marginTop: 4, textAlign: "center", maxWidth: 280 }}>
                设相似度阈值，跑一遍去重扫描。
              </div>
            </div>
          )}
        </div>

        <div style={historyPanelStyle}>
          <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            合并历史
          </div>
          {mergeHistory.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {mergeHistory.map((entry) => (
                <div key={entry.id} style={historyRowStyle}>
                  <GitMerge size={11} color="#f2b66d" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.summary}
                    </div>
                    <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 10 }}>
                      {entry.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12 }}>还没有合并历史。扫了不合并不算历史。</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── styles ─────────────────────────────────────────────────────── */

const shellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  background: "var(--dsw-alias-bg-base, #ffffff)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  padding: "20px 24px 16px",
  borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  flexShrink: 0,
};

const controlsCardStyle: React.CSSProperties = {
  margin: "16px 24px",
  padding: "16px 20px",
  borderRadius: 14,
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  flexShrink: 0,
};

const scanBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "10px 18px",
  borderRadius: 10,
  background: "var(--dsw-alias-brand-primary, #0969da)",
  border: "1px solid transparent",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};

const pairCardStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
};

const entityChipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 8,
  background: "var(--dsw-alias-bg-layer-2, #eef1f4)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 12,
  fontWeight: 600,
};

const actionBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--dsw-alias-label-secondary, #3d444d)",
  cursor: "pointer",
  padding: 4,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
};

const diffCardStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "var(--dsw-alias-bg-layer-2, #eef1f4)",
  border: "1px solid transparent",
};

const historyPanelStyle: React.CSSProperties = {
  width: 240,
  borderLeft: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  padding: "16px 16px",
  overflowY: "auto",
  flexShrink: 0,
};

const historyRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  padding: "8px 0",
  borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.08))",
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 40,
  minHeight: 200,
};

const clearAllBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--dsw-alias-label-secondary, #3d444d)",
  fontSize: 12,
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: 6,
};
