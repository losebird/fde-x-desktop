import { useCallback, useEffect, useState } from "react";
import {
  BookMarked,
  GitMerge,
  HeartPulse,
  Layers,
  Shield,
  Sliders,
} from "lucide-react";
import { AlignmentsTab } from "./AlignmentsTab";
import { HealthTab } from "./HealthTab";
import { OntologyManager } from "./OntologyManager";
import { OntologyEditor } from "./OntologyEditor";
import { ShaclStudio } from "./ShaclStudio";
import { VersionsTab } from "./VersionsTab";

export type OntologyHubTab =
  | "registry"
  | "editor"
  | "versions"
  | "alignments"
  | "health"
  | "shacl";

const TAB_PARAM = "ontologyTab";

const TABS: { id: OntologyHubTab; label: string; icon: typeof GitMerge }[] = [
  { id: "registry", label: "词表列表", icon: BookMarked },
  { id: "editor", label: "编辑", icon: Sliders },
  { id: "versions", label: "版本", icon: Layers },
  { id: "alignments", label: "对齐", icon: GitMerge },
  { id: "health", label: "健康", icon: HeartPulse },
  { id: "shacl", label: "规则检查", icon: Shield },
];

function readTabParam(): OntologyHubTab {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(TAB_PARAM);
    if (raw && TABS.some((t) => t.id === raw)) return raw as OntologyHubTab;
  } catch {
    // ignore
  }
  return "registry";
}

function writeTabParam(tab: OntologyHubTab) {
  try {
    const params = new URLSearchParams(window.location.search);
    params.set(TAB_PARAM, tab);
    window.history.replaceState(null, "", `?${params.toString()}`);
  } catch {
    // ignore
  }
}

interface OntologyWorkspaceProps {
  onJumpToGraphNode?: (nodeId: string) => void;
  initialTab?: OntologyHubTab;
}

export function OntologyWorkspace({ onJumpToGraphNode, initialTab }: OntologyWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<OntologyHubTab>(initialTab || readTabParam);

  useEffect(() => {
    writeTabParam(activeTab);
  }, [activeTab]);

  const handleTabChange = useCallback((tab: OntologyHubTab) => {
    setActiveTab(tab);
  }, []);

  const handleFixInEditor = useCallback((entityUri: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(TAB_PARAM, "editor");
    params.set("ontologyEntity", entityUri);
    window.history.replaceState(null, "", `?${params.toString()}`);
    setActiveTab("editor");
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case "registry":
        return <OntologyManager />;
      case "editor":
        return <OntologyEditor />;
      case "versions":
        return <VersionsTab />;
      case "alignments":
        return <AlignmentsTab />;
      case "health":
        return <HealthTab onFixInEditor={handleFixInEditor} />;
      case "shacl":
        return <ShaclStudio onJumpToNode={onJumpToGraphNode} />;
    }
  };

  return (
    <div className="ws-page">
      {/* Internal sub-tab bar */}
      <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: "1px solid var(--ws-border)", background: "var(--dsw-alias-bg-layer-1, #f6f8fa)", flexShrink: 0, flexWrap: "wrap" }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 999, border: `1px solid ${active ? "var(--ws-border-strong)" : "transparent"}`, background: active ? "var(--ws-accent-soft)" : "transparent", color: active ? "var(--ws-text)" : "var(--ws-text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "160ms ease" }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{renderTab()}</div>
    </div>
  );
}

