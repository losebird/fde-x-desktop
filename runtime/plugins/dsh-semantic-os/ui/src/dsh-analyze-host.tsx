import { useEffect, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReasoningWorkspace } from "./workspaces/ReasoningWorkspace";
import { SparqlWorkspace } from "./workspaces/SparqlWorkspace/SparqlWorkspace";
import { ErrorBoundary } from "./ErrorBoundary";
import { applyDshGraphTheme } from "./dsh-theme";
import { clearLastReasonBody, getLastReasonBody, graphNonempty, installApiBridge, type ReasonMode } from "./dsh-api";
import { installChineseI18n } from "./dsh-i18n";
import { HostNav, type HostAction } from "./dsh-host-nav";
import { createJobStore } from "./jobStore";
import "./dsh-ws.css";
import "./dsh-theme.css";

export type AnalyzeMountOptions = {
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

type Phase = "idle" | "preview" | "written";

const analyzeBar = createJobStore({
  phase: "idle" as Phase,
  busy: false,
  fail: "",
});
let analyzeWriteInflight: Promise<void> | null = null;

function ModeBar(props: {
  mode: ReasonMode;
  setMode: Dispatch<SetStateAction<ReasonMode>>;
  phase: Phase;
  busy: boolean;
  fail: string;
  onWrite: () => void;
  onRedo: () => void;
  hostActions?: HostAction[];
}) {
  const modeHint = props.mode === "datalog" ? "按规则从已知推未知" : props.mode === "rete" ? "模式匹配走引擎现成网络" : "往前推走规则链式推导";
  const hint = (props.phase === "written" ? "已写入图" : "预览，不写图") + " · " + modeHint;
  return (
    <div className="dsh-lock-bar">
      <HostNav actions={props.hostActions} />
      <button
        type="button"
        className={"dsh-mode-btn" + (props.mode === "forward" ? " is-on" : "")}
        onClick={() => props.setMode("forward")}
      >
        往前推
      </button>
      <button
        type="button"
        className={"dsh-mode-btn" + (props.mode === "rete" ? " is-on" : "")}
        onClick={() => props.setMode("rete")}
      >
        模式匹配
      </button>
      <button
        type="button"
        className={"dsh-mode-btn" + (props.mode === "datalog" ? " is-on" : "")}
        title="按规则从已知推未知"
        onClick={() => props.setMode("datalog")}
      >
        逻辑规则
      </button>
      <span className="dsh-lock-hint">{hint}</span>
      {props.phase === "preview" ? (
        <button type="button" className="dsh-mode-btn is-on" onClick={props.onWrite} disabled={props.busy}>
          确认写入
        </button>
      ) : null}
      <button
        type="button"
        className="dsh-mode-btn"
        onClick={props.onRedo}
        disabled={props.busy || props.phase === "idle"}
        title={props.phase === "idle" ? "先跑一次推理预览" : "预览不写图，可打回重做"}
      >
        打回重做
      </button>
      {props.fail ? <span className="dsh-fail">{props.fail}</span> : null}
    </div>
  );
}

function FoldedSparql() {
  const [open, setOpen] = useState(false);
  return (
    <div className="dsh-sparql-fold">
      <button type="button" className="dsh-fold-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "收起图查询" : "图查询已折上"}
      </button>
      {open ? (
        <div className="dsh-sparql-body">
          <ErrorBoundary>
            <SparqlWorkspace />
          </ErrorBoundary>
        </div>
      ) : null}
    </div>
  );
}

function AnalyzeApp(props: { cwd: string; modeRef: { current: ReasonMode }; hostActions?: HostAction[] }) {
  const [mode, setMode] = useState<ReasonMode>("forward");
  const bar = useSyncExternalStore(analyzeBar.subscribe, analyzeBar.get, analyzeBar.get);
  const phase = bar.phase;
  const busy = bar.busy;
  const fail = bar.fail;
  const setPhase = (value: Phase) => analyzeBar.set({ phase: value });
  const setBusy = (value: boolean) => analyzeBar.set({ busy: value });
  const setFail = (value: string) => analyzeBar.set({ fail: value });
  props.modeRef.current = mode;

  useEffect(() => {
    const onPreview = () => {
      setPhase("preview");
      setFail("");
    };
    const onApplied = () => {
      setPhase("written");
      setFail("");
    };
    const onFailed = (event: Event) => {
      const detail = (event as CustomEvent<{ engine?: string; detail?: string; error?: string }>).detail || {};
      const engine = String(detail.engine || "");
      const extra = detail.detail ? String(detail.detail) : "";
      if (engine === "datalog") setFail(extra ? `逻辑规则没跑成。${extra}` : "逻辑规则没跑成。");
      else if (engine === "rete") setFail(extra ? `模式匹配没跑成。${extra}` : "模式匹配没跑成。");
      else setFail(extra ? `推理没跑成。${extra}` : "推理没跑成。");
    };
    window.addEventListener("dsh-reason-previewed", onPreview);
    window.addEventListener("dsh-reason-applied", onApplied);
    window.addEventListener("dsh-reason-failed", onFailed);
    return () => {
      window.removeEventListener("dsh-reason-previewed", onPreview);
      window.removeEventListener("dsh-reason-applied", onApplied);
      window.removeEventListener("dsh-reason-failed", onFailed);
    };
  }, []);

  const onRedo = () => {
    clearLastReasonBody();
    window.dispatchEvent(new Event("dsh-reason-redo"));
    setPhase("idle");
    setFail("");
  };

  const onWrite = async () => {
    if (analyzeWriteInflight) return analyzeWriteInflight;
    const last = getLastReasonBody();
    if (!last) {
      setFail("还没有可写入的预览。");
      return;
    }
    setBusy(true);
    setFail("");
    analyzeWriteInflight = (async () => {
      try {
        let nonempty = false;
        try {
          const listed = await fetch(`/semantic-os/nodes?cwd=${encodeURIComponent(props.cwd)}`);
          nonempty = graphNonempty(await listed.json().catch(() => null));
        } catch {
          nonempty = false;
        }
        if (nonempty && !window.confirm("图里已有内容。写入推断会加成边，确定吗？")) {
          setBusy(false);
          return;
        }
        const res = await fetch("/semantic-os/api/reason", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dsh-reason-write": "1",
            "x-dsh-cwd": props.cwd,
          },
          body: JSON.stringify({
            ...last,
            mode: props.modeRef.current,
            apply_to_graph: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "写入没写成。");
      } catch (error) {
        setFail(error instanceof Error ? error.message : "写入没写成。");
      } finally {
        setBusy(false);
        analyzeWriteInflight = null;
      }
    })();
    return analyzeWriteInflight;
  };

  return (
    <div className="dsh-analyze-frame">
      <ModeBar
        mode={mode}
        setMode={setMode}
        phase={phase}
        busy={busy}
        fail={fail}
        onWrite={() => void onWrite()}
        onRedo={onRedo}
        hostActions={props.hostActions}
      />
      <div className="dsh-analyze-bench">
        <ReasoningWorkspace mode={mode} />
      </div>
      <FoldedSparql />
    </div>
  );
}

export function mount(el: HTMLElement, opts: AnalyzeMountOptions = {}): () => void {
  const cwd = String(opts.cwd || "");
  const modeRef = { current: "forward" as ReasonMode };
  el.classList.add("dsh-analyze-host", "dsh-ws-host");
  applyDshGraphTheme();
  const queryClient = makeClient();
  const restoreFetch = installApiBridge(cwd, {
    reasonMode: () => modeRef.current,
  });
  const stopI18n = installChineseI18n(el);
  const root: Root = createRoot(el);
  root.render(
    <QueryClientProvider client={queryClient}>
      <AnalyzeApp cwd={cwd} modeRef={modeRef} hostActions={opts.hostActions} />
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
