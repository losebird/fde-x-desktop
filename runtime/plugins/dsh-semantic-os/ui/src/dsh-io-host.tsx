import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImportExportWorkspace } from "./workspaces/ImportExportWorkspace/ImportExportWorkspace";
import { ErrorBoundary } from "./ErrorBoundary";
import { applyDshGraphTheme } from "./dsh-theme";
import { installApiBridge } from "./dsh-api";
import { installChineseI18n } from "./dsh-i18n";
import "./dsh-ws.css";
import "./dsh-theme.css";

export type IoMountOptions = {
  cwd?: string;
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

export function mount(el: HTMLElement, opts: IoMountOptions = {}): () => void {
  const cwd = String(opts.cwd || "");
  el.classList.add("dsh-io-host", "dsh-ws-host");
  applyDshGraphTheme();
  const queryClient = makeClient();
  const restoreFetch = installApiBridge(cwd, { ioLock: true });
  const stopI18n = installChineseI18n(el);
  const root: Root = createRoot(el);
  root.render(
    <QueryClientProvider client={queryClient}>
      <div className="dsh-io-frame">
        <ErrorBoundary>
          <ImportExportWorkspace />
        </ErrorBoundary>
      </div>
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
