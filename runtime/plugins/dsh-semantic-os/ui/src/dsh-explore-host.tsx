import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GraphWorkspace } from "./workspaces/GraphWorkspace/GraphWorkspace";
import { applyDshGraphTheme } from "./dsh-theme";
import { installApiBridge } from "./dsh-api";
import { installChineseI18n } from "./dsh-i18n";
import { clearGraph } from "./store/graphStore";
import "./index.css";
import "./ui/primitives.css";
import "./dsh-theme.css";

export type ExploreMountOptions = {
  cwd?: string;
  hostActions?: Array<{ id: string; label: string; onClick: () => void }>;
};

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: 1 },
    },
  });
}

export function mount(el: HTMLElement, opts: ExploreMountOptions = {}): () => void {
  const cwd = String(opts.cwd || "");
  el.classList.add("dsh-explore-host");
  el.dataset.cwd = cwd;
  applyDshGraphTheme();
  try { clearGraph(); } catch { /* keep */ }
  const queryClient = makeClient();
  const restoreFetch = installApiBridge(cwd);
  const stopI18n = installChineseI18n(el);
  const root: Root = createRoot(el);
  root.render(
    <QueryClientProvider client={queryClient}>
      <GraphWorkspace hostActions={opts.hostActions} />
    </QueryClientProvider>,
  );
  return () => {
    stopI18n();
    restoreFetch();
    root.unmount();
    queryClient.clear();
    try { clearGraph(); } catch { /* keep */ }
  };
}

export default { mount };
