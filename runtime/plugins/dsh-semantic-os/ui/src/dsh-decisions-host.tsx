import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DecisionWorkspace } from "./workspaces/DecisionWorkspace/DecisionWorkspace";
import { applyDshGraphTheme } from "./dsh-theme";
import { installApiBridge } from "./dsh-api";
import { installChineseI18n } from "./dsh-i18n";
import { HostNav, type HostAction } from "./dsh-host-nav";
import "./dsh-ws.css";
import "./dsh-theme.css";

export type DecisionsMountOptions = {
  cwd?: string;
  hostActions?: HostAction[];
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

function PrecedentsStrip(props: { hostActions?: HostAction[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [body, setBody] = useState<unknown>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onSel = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id || "";
      if (!id) return;
      setSelectedId(id);
      setBody(null);
      setErr("");
      setOpen(false);
    };
    window.addEventListener("dsh-decision-selected", onSel);
    return () => window.removeEventListener("dsh-decision-selected", onSel);
  }, []);

  const load = () => {
    if (!selectedId) {
      setErr("先例没加载成。");
      return;
    }
    setErr("");
    fetch(`/api/decisions/${encodeURIComponent(selectedId)}/precedents`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error("fail");
        setBody(data);
        setOpen(true);
      })
      .catch(() => setErr("先例没加载成。"));
  };

  return (
    <div className="dsh-precedents-strip">
      <div className="dsh-lock-bar">
        <HostNav actions={props.hostActions} />
        <button type="button" className="dsh-mode-btn" onClick={load} disabled={!selectedId}>
          先例
        </button>
        {err ? <span className="dsh-fail">{err}</span> : null}
      </div>
      {open && body ? (
        <pre className="dsh-precedents-pre">{JSON.stringify(body, null, 2)}</pre>
      ) : null}
    </div>
  );
}

function DecisionsApp(props: { hostActions?: HostAction[] }) {
  return (
    <div className="dsh-decisions-frame">
      <PrecedentsStrip hostActions={props.hostActions} />
      <div className="dsh-decisions-bench">
        <DecisionWorkspace />
      </div>
    </div>
  );
}

export function mount(el: HTMLElement, opts: DecisionsMountOptions = {}): () => void {
  const cwd = String(opts.cwd || "");
  el.classList.add("dsh-decisions-host");
  applyDshGraphTheme();
  const queryClient = makeClient();
  const restoreFetch = installApiBridge(cwd);
  const stopI18n = installChineseI18n(el);
  const root: Root = createRoot(el);
  root.render(
    <QueryClientProvider client={queryClient}>
      <DecisionsApp hostActions={opts.hostActions} />
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
