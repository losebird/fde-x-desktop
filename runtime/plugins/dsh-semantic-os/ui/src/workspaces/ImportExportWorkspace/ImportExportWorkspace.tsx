import { useState, useCallback, useSyncExternalStore } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Download, FileJson, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { logEvent } from "../../store/registryStore";
import { createJobStore } from "../../jobStore";

interface Toast { id: number; type: "success" | "error"; text: string }

const ioJob = createJobStore({
  isUploading: false,
  isExporting: false,
  exportFormat: "json" as "json" | "csv",
  toast: null as Toast | null,
});
let ioImportInflight: Promise<void> | null = null;
let ioExportInflight: Promise<void> | null = null;

export function ImportExportWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const job = useSyncExternalStore(ioJob.subscribe, ioJob.get, ioJob.get);
  const isUploading = job.isUploading;
  const isExporting = job.isExporting;
  const exportFormat = job.exportFormat;
  const setExportFormat = (value: "json" | "csv") => ioJob.set({ exportFormat: value });
  const [toasts, setToasts] = useState<Toast[]>(job.toast ? [job.toast] : []);

  function showToast(type: Toast["type"], text: string) {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, text }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/json": [".json"], "text/csv": [".csv"] },
    maxFiles: 1,
  });

  async function handleImport() {
    if (!file || ioImportInflight) return ioImportInflight;
    ioJob.set({ isUploading: true });
    const picked = file;
    ioImportInflight = (async () => {
      try {
        const fd = new FormData();
        fd.append("file", picked);
        const res = await fetch("/api/import", { method: "POST", body: fd });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "导入没写成。"); }
        const data = await res.json();
        showToast("success", `已导入 ${data.nodes_imported} 个节点 · ${data.edges_imported} 条边`);
        logEvent("import", `Imported ${data.nodes_imported} nodes · ${data.edges_imported} edges from ${picked.name}`, { file: picked.name });
        setFile(null);
      } catch (e: unknown) {
        showToast("error", e instanceof Error ? e.message : "导入没写成。");
      } finally {
        ioJob.set({ isUploading: false });
        ioImportInflight = null;
      }
    })();
    return ioImportInflight;
  }

  async function handleExport() {
    if (ioExportInflight) return ioExportInflight;
    ioJob.set({ isExporting: true });
    const format = ioJob.get().exportFormat;
    ioExportInflight = (async () => {
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "导出没写成。"); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `graph.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("success", `导出已就绪 — graph.${format}`);
        logEvent("export", `Exported graph as ${format.toUpperCase()}`, { format });
      } catch (e: unknown) {
        showToast("error", e instanceof Error ? e.message : "导出没写成。");
      } finally {
        ioJob.set({ isExporting: false });
        ioExportInflight = null;
      }
    })();
    return ioExportInflight;
  }

  return (
    <div className="ws-page ws-scroll">
      <div className="ws-padded" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 980, margin: "0 auto", width: "100%" }}>
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", display: "grid", placeItems: "center", color: "var(--ws-accent)", flexShrink: 0 }}>
            <UploadCloud size={20} />
          </div>
          <div>
            <h2 className="ws-title" style={{ fontSize: 18 }}>导入导出</h2>
            <div className="ws-body" style={{ marginTop: 2 }}>导入新数据集，或导出当前知识库。</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* ── Import card ── */}
          <div className="ws-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <UploadCloud size={16} color="var(--ws-accent)" />
              <div style={{ color: "var(--ws-text)", fontWeight: 700, fontSize: 14 }}>导入实体与关系</div>
            </div>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? "var(--ws-accent)" : "var(--ws-border)"}`,
                borderRadius: "var(--ws-radius)",
                background: isDragActive ? "var(--ws-accent-soft)" : "var(--dsw-alias-bg-layer-2, #eef1f4)",
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 200ms ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  {file.name.endsWith(".json") ? <FileJson size={40} color="#4cc38a" /> : <FileText size={40} color="#4cc38a" />}
                  <div style={{ color: "var(--ws-text)", fontWeight: 700 }}>{file.name}</div>
                  <div className="ws-body" style={{ fontSize: 11 }}>{(file.size / 1024).toFixed(1)} KB — 点击替换</div>
                </>
              ) : (
                <>
                  <UploadCloud size={36} color="var(--ws-accent)" style={{ opacity: 0.7 }} />
                  <div style={{ color: "var(--ws-text)", fontWeight: 600 }}>拖放或点击浏览</div>
                  <div className="ws-pill ws-pill--mono">.json</div>
                  <span style={{ color: "var(--ws-text-dim)", fontSize: 11 }}>或</span>
                  <div className="ws-pill ws-pill--mono">.csv</div>
                </>
              )}
            </div>

            <button
              className="ws-btn ws-btn--primary"
              onClick={handleImport}
              disabled={!file || isUploading}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {isUploading ? <><Loader2 size={15} className="ws-spin" />上传中…</> : <><UploadCloud size={15} />上传到图</>}
            </button>
          </div>

          {/* ── Export card ── */}
          <div className="ws-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Download size={16} color="var(--ws-purple)" />
              <div style={{ color: "var(--ws-text)", fontWeight: 700, fontSize: 14 }}>导出图谱快照</div>
            </div>

            <div>
              <label className="ws-label">格式</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["json", "csv"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    className={`ws-btn ${exportFormat === fmt ? "ws-btn--primary" : "ws-btn--ghost"}`}
                    style={{ flex: 1, justifyContent: "center", textTransform: "uppercase", fontSize: 12 }}
                    onClick={() => setExportFormat(fmt)}
                  >
                    {fmt === "json" ? <FileJson size={14} /> : <FileText size={14} />}
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, padding: "14px 16px", borderRadius: "var(--ws-radius-sm)", background: "var(--dsw-alias-bg-layer-2, #eef1f4)", border: "1px solid var(--ws-border)" }}>
              <div style={{ color: "var(--ws-text-muted)", fontWeight: 700, fontSize: 12, marginBottom: 6 }}>会带上什么</div>
              <div className="ws-body" style={{ fontSize: 12 }}>
                {exportFormat === "json"
                  ? "完整图快照：节点属性、边权重和元数据，JSON。"
                  : "扁平 CSV：节点和边各成行。适合表格分析。"}
              </div>
            </div>

            <button
              className="ws-btn"
              onClick={handleExport}
              disabled={isExporting}
              style={{ width: "100%", justifyContent: "center", background: "var(--ws-purple-soft)", borderColor: "rgba(192,132,252,0.3)", color: "#d8b4fe" }}
            >
              {isExporting ? <><Loader2 size={15} className="ws-spin" />准备中…</> : <><Download size={15} />下载导出</>}
            </button>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 28, right: 28, display: "flex", flexDirection: "column", gap: 10, zIndex: 1000 }}>
        {toasts.map((t) => (
          <div key={t.id} className="ws-animate-in" style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderRadius: "var(--ws-radius-sm)", background: t.type === "success" ? "var(--dsw-alias-bg-layer-1, #f6f8fa)" : "var(--dsw-alias-bg-layer-1, #f6f8fa)", border: `1px solid ${t.type === "success" ? "rgba(76,195,138,0.4)" : "rgba(255,123,114,0.4)"}`, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}>
            {t.type === "success" ? <CheckCircle2 size={16} color="#4cc38a" /> : <AlertCircle size={16} color="#ff7b72" />}
            <span style={{ color: "var(--ws-text)", fontSize: 13, fontWeight: 500 }}>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
