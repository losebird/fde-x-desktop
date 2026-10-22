import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VocabularyWorkspace } from "./workspaces/VocabularyWorkspace/VocabularyWorkspace";
import { EntityResolutionTab, setEntityResolutionCwd } from "./workspaces/EnrichWorkspace/EntityResolutionTab";
import { OntologyWorkspace } from "./workspaces/OntologyWorkspace";
import { ErrorBoundary } from "./ErrorBoundary";
import { applyDshGraphTheme } from "./dsh-theme";
import { installApiBridge } from "./dsh-api";
import { installChineseI18n } from "./dsh-i18n";
import { HostNav, type HostAction } from "./dsh-host-nav";
import "./dsh-ws.css";
import "./dsh-theme.css";

export type OntologyMountOptions = {
  cwd?: string;
  hostActions?: HostAction[];
};

type OntoView = "registry" | "vocab" | "er" | "hub";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

function downloadNamed(filename: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function OntologyPackBar() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  async function run(op: "owl" | "skos" | "conflicts") {
    if (busy) return;
    setMsg("");
    setBusy(op);
    const path = op === "owl" ? "/api/ontology/export-owl"
      : op === "skos" ? "/api/ontology/export-skos"
        : "/api/ontology/conflicts";
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (data && data.error === "EXTRA_MISSING") {
        setMsg("本机没装这套依赖，导出/扫描不可用。");
        return;
      }
      if (!res.ok || (data && data.error && data.ok === false && !data.data && !data.conflicts)) {
        setMsg(String((data && (data.detail || data.error)) || "没写成。"));
        return;
      }
      if (op === "conflicts") {
        const rows = Array.isArray(data.conflicts) ? data.conflicts : [];
        setMsg(rows.length ? `冲突 ${rows.length} 条` : "没有扫到冲突");
        return;
      }
      const text = typeof data.data === "string" ? data.data : JSON.stringify(data, null, 2);
      downloadNamed(op === "owl" ? "ontology.owl" : "vocabulary.skos.json", text, op === "owl" ? "application/rdf+xml" : "application/json");
      setMsg(op === "owl" ? "已导出 OWL" : "已导出 SKOS");
    } catch {
      setMsg("没写成。");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <button type="button" className="dsh-mode-btn" disabled={Boolean(busy)} onClick={() => void run("owl")}>
        {busy === "owl" ? "导出中…" : "导出 OWL"}
      </button>
      <button type="button" className="dsh-mode-btn" disabled={Boolean(busy)} onClick={() => void run("skos")}>
        {busy === "skos" ? "导出中…" : "导出 SKOS"}
      </button>
      <button type="button" className="dsh-mode-btn" disabled={Boolean(busy)} onClick={() => void run("conflicts")}>
        {busy === "conflicts" ? "扫描中…" : "扫描冲突"}
      </button>
      {msg ? <span className="dsh-lock-hint">{msg}</span> : null}
    </>
  );
}

function OntologyApp(props: { hostActions?: HostAction[] }) {
  const [view, setView] = useState<OntoView>("registry");
  return (
    <div className="dsh-ontology-frame">
      <div className="dsh-lock-bar">
        <HostNav actions={props.hostActions} />
        <button type="button" className={"dsh-mode-btn" + (view === "registry" ? " is-on" : "")} onClick={() => setView("registry")}>
          词表列表
        </button>
        <button type="button" className={"dsh-mode-btn" + (view === "vocab" ? " is-on" : "")} onClick={() => setView("vocab")}>
          词表
        </button>
        <button type="button" className={"dsh-mode-btn" + (view === "er" ? " is-on" : "")} onClick={() => setView("er")}>
          消歧
        </button>
        <button type="button" className={"dsh-mode-btn" + (view === "hub" ? " is-on" : "")} onClick={() => setView("hub")}>
          规则检查
        </button>
        <OntologyPackBar />
      </div>
      <div className="dsh-ontology-bench">
        <ErrorBoundary>
          {view === "registry" ? <OntologyWorkspace initialTab="registry" /> : null}
          {view === "vocab" ? <VocabularyWorkspace /> : null}
          {view === "er" ? <EntityResolutionTab /> : null}
          {view === "hub" ? <OntologyWorkspace initialTab="shacl" /> : null}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export function mount(el: HTMLElement, opts: OntologyMountOptions = {}): () => void {
  const cwd = String(opts.cwd || "");
  setEntityResolutionCwd(cwd);
  el.classList.add("dsh-ontology-host", "dsh-ws-host");
  applyDshGraphTheme();
  const queryClient = makeClient();
  const restoreFetch = installApiBridge(cwd, { mergeConfirm: true });
  const stopI18n = installChineseI18n(el);
  const root: Root = createRoot(el);
  root.render(
    <QueryClientProvider client={queryClient}>
      <OntologyApp hostActions={opts.hostActions} />
    </QueryClientProvider>,
  );
  return () => {
    stopI18n();
    restoreFetch();
    root.unmount();
    queryClient.clear();
  };
}

export default { mount };
