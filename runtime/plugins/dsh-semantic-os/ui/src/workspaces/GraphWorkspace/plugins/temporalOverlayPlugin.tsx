import type { CSSProperties } from "react";

import type { GraphPlugin } from "./types";

const TEMPORAL_PANEL_ID = "temporal-panel";

function formatTemporalLabel(value: Date | null) {
  if (!value) {
    return "还没选时间";
  }
  return `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}`;
}

function formatBoundLabel(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}`;
}

export const temporalOverlayPlugin: GraphPlugin = {
  id: "temporal-overlay",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "temporal-toggle",
      label: "Temporal",
      title: "Toggle temporal context panel",
      active: context.isPanelOpen(TEMPORAL_PANEL_ID),
      order: 40,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: TEMPORAL_PANEL_ID }),
    },
  ],
  renderOverlay: (context) => {
    const temporal = context.getTemporalState();
    if (!temporal?.currentTime) {
      return null;
    }

    const label = formatTemporalLabel(temporal.currentTime);
    return {
      id: "temporal-overlay-chip",
      layer: 1,
      order: 10,
      element: (
        <div
          style={{
            position: "absolute",
            left: 140,
            bottom: 26,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
            background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
            boxShadow: "none",
            color: "var(--dsw-alias-label-primary, #1f2328)",
            fontSize: 11,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          <span style={{ color: "var(--dsw-alias-brand-primary, #0969da)", fontWeight: 700 }}>时序</span>
          <span>{label}</span>
          {typeof temporal.activeNodeCount === "number" ? (
            <span style={{ color: "color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))" }}>{temporal.activeNodeCount.toLocaleString()} 个活动</span>
          ) : null}
        </div>
      ),
    };
  },
  renderPanel: (context) => {
    if (!context.isPanelOpen(TEMPORAL_PANEL_ID)) {
      return null;
    }

    const temporal = context.getTemporalState();
    return {
      id: TEMPORAL_PANEL_ID,
      title: "时序",
      placement: "bottom",
      order: 30,
      defaultOpen: false,
      preferredWidth: 320,
      preferredHeight: 220,
      content: (
        <div style={panelBodyStyle}>
          <div style={panelEyebrowStyle}>当前时间</div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>现在</span>
            <span style={detailValueStyle}>{formatTemporalLabel(temporal?.currentTime ?? null)}</span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>范围</span>
            <span style={detailValueStyle}>
              {formatBoundLabel(temporal?.minDate, "近 30 天")} → {formatBoundLabel(temporal?.maxDate, "今天")}
            </span>
          </div>
          <div style={detailRowStyle}>
            <span style={detailLabelStyle}>活动节点</span>
            <span style={detailValueStyle}>
              {typeof temporal?.activeNodeCount === "number" ? temporal.activeNodeCount.toLocaleString() : "全部"}
            </span>
          </div>
        </div>
      ),
    };
  },
};

const panelBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const panelEyebrowStyle: CSSProperties = {
  color: "color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const detailRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
};

const detailLabelStyle: CSSProperties = {
  color: "color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))",
  fontSize: 12,
};

const detailValueStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12,
  fontWeight: 600,
};
