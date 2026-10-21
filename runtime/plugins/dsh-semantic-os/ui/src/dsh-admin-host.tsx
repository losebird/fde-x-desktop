import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KGOverviewTab } from "./workspaces/ManageWorkspace/KGOverviewTab";
import { OntologySummaryTab } from "./workspaces/ManageWorkspace/OntologySummaryTab";
import { LineageDiagram } from "./workspaces/LineageWorkspace/LineageDiagram";
import { ErrorBoundary } from "./ErrorBoundary";
import { applyDshGraphTheme } from "./dsh-theme";
import { installApiBridge } from "./dsh-api";
import { installChineseI18n } from "./dsh-i18n";
import "./dsh-ws.css";
import "./dsh-theme.css";

export type AdminMountOptions = {
  cwd?: string;
};

type AdminView = "kg" | "lineage" | "ontology";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

function AdminApp() {
  const [view, setView] = useState<AdminView>("kg");
  return (
    <div className="dsh-admin-frame workspace-shell">
      <div className="dsh-lock-bar">
        <button type="button" className={"dsh-mode-btn" + (view === "kg" ? " is-on" : "")} onClick={() => setView("kg")}>
          图谱总览
        </button>
        <button type="button" className={"dsh-mode-btn" + (view === "lineage" ? " is-on" : "")} onClick={() => setView("lineage")}>
          血缘
        </button>
        <button type="button" className={"dsh-mode-btn" + (view === "ontology" ? " is-on" : "")} onClick={() => setView("ontology")}>
          本体摘要
        </button>
      </div>
      <div className="dsh-admin-bench">
        <ErrorBoundary>
          {view === "kg" ? <KGOverviewTab /> : null}
          {view === "lineage" ? <LineageDiagram /> : null}
          {view === "ontology" ? <OntologySummaryTab /> : null}
        </ErrorBoundary>
      </div>
    </div>
  );
}

export function mount(el: HTMLElement, opts: AdminMountOptions = {}): () => void {
  const cwd = String(opts.cwd || "");
  el.classList.add("dsh-admin-host", "dsh-ws-host");
  applyDshGraphTheme();
  const queryClient = makeClient();
  const restoreFetch = installApiBridge(cwd);
  const stopI18n = installChineseI18n(el);
  const root: Root = createRoot(el);
  root.render(
    <QueryClientProvider client={queryClient}>
      <AdminApp />
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
