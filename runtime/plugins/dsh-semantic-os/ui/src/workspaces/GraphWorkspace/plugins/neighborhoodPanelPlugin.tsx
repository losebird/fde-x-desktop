import type { CSSProperties } from "react";

import type { GraphPlugin } from "./types";

const NEIGHBORHOOD_PANEL_ID = "neighborhood-panel";
const MAX_NEIGHBORS = 10;

function maxWeightBetween(graphRef: any, sourceId: string, targetId: string): number {
  let weight = 0;
  graphRef.forEachDirectedEdge(sourceId, targetId, (_edgeId: string, attrs: { weight?: number }) => {
    weight = Math.max(weight, Number(attrs.weight ?? 0));
  });
  return weight;
}

function formatNeighborMeta(neighbor: { nodeType: string; degree: number; weight: number }) {
  const parts = [neighbor.nodeType, `度数 ${neighbor.degree}`];
  if (neighbor.weight > 0) {
    parts.push(`权重 ${neighbor.weight.toFixed(2)}`);
  }
  return parts.join(" · ");
}

export const neighborhoodPanelPlugin: GraphPlugin = {
  id: "neighborhood-panel",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "neighborhood-toggle",
      label: "Neighbors",
      title: "Toggle neighborhood panel",
      active: context.isPanelOpen(NEIGHBORHOOD_PANEL_ID),
      order: 30,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: NEIGHBORHOOD_PANEL_ID }),
    },
  ],
  renderPanel: (context) => {
    if (!context.isPanelOpen(NEIGHBORHOOD_PANEL_ID)) {
      return null;
    }

    const selected = context.getSelectedNodeState();
    const displayState = context.getDisplayState();
    if (!selected) {
      return {
        id: NEIGHBORHOOD_PANEL_ID,
        title: "邻居",
        placement: "bottom",
        order: 20,
        defaultOpen: false,
        preferredWidth: 360,
        preferredHeight: 260,
        content: <div style={emptyTextStyle}>先点图上一个点，再看它旁边连了谁。</div>,
      };
    }

    const neighbors = context.graph
      .neighbors(selected.id)
      .map((neighborId) => {
        const attrs = context.graph.getNodeAttributes(neighborId);
        const weight = Math.max(
          maxWeightBetween(context.graph, selected.id, neighborId),
          maxWeightBetween(context.graph, neighborId, selected.id),
        );
        return {
          id: neighborId,
          label: String(attrs.label || neighborId),
          nodeType: String(attrs.nodeType || "Entity"),
          color: String(attrs.baseColor || attrs.color || context.theme.palette.semantic[0]),
          weight,
          degree: context.graph.degree(neighborId),
        };
      })
      .sort((left, right) => {
        if (right.weight !== left.weight) {
          return right.weight - left.weight;
        }
        if (right.degree !== left.degree) {
          return right.degree - left.degree;
        }
        return left.label.localeCompare(right.label);
      })
      .slice(0, MAX_NEIGHBORS);
    const hiddenNeighborCount = displayState.selectedCollapsedNeighborIds.length;
    const aggregatedEdgeCount = context.displayGraph
      .edges()
      .map((edgeId) => context.displayGraph.getEdgeAttributes(edgeId) as { isAggregated?: boolean })
      .filter((attrs) => attrs.isAggregated).length;

    return {
      id: NEIGHBORHOOD_PANEL_ID,
      title: "邻居",
      placement: "bottom",
      order: 20,
      defaultOpen: false,
      preferredWidth: 360,
      preferredHeight: 260,
      content: (
        <div style={panelBodyStyle}>
          <div style={panelEyebrowStyle}>{selected.label}</div>
          <div style={summaryStyle}>
            全图里有 {selected.neighborCount.toLocaleString()} 个直接邻居
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => context.dispatchAction({ type: "collapseNeighborhood" })}
              disabled={!selected.canCollapseNeighborhood || selected.isNeighborhoodCollapsed}
              style={controlButtonStyle}
            >
              收起邻居
            </button>
            <button
              type="button"
              onClick={() => context.dispatchAction({ type: "expandNeighborhood" })}
              disabled={!selected.isNeighborhoodCollapsed}
              style={controlButtonStyle}
            >
              展开邻居
            </button>
          </div>
          {hiddenNeighborCount > 0 ? (
            <div style={summaryStyle}>
              当前视图收起了 {hiddenNeighborCount.toLocaleString()} 个次要邻居。
            </div>
          ) : null}
          {aggregatedEdgeCount > 0 ? (
            <div style={summaryStyle}>
              当前能看到 {aggregatedEdgeCount.toLocaleString()} 条合并的结构边。
            </div>
          ) : null}
          {neighbors.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {neighbors.map((neighbor) => (
                <button
                  key={neighbor.id}
                  type="button"
                  onClick={() => context.dispatchAction({ type: "selectNode", nodeId: neighbor.id })}
                  style={neighborButtonStyle}
                >
                  <span
                    style={{
                      ...swatchStyle,
                      background: neighbor.color,
                      boxShadow: `0 0 16px ${neighbor.color}40`,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                    <div style={rowTitleStyle}>{neighbor.label}</div>
                    <div style={rowMetaStyle}>{formatNeighborMeta(neighbor)}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={emptyTextStyle}>这个点没有直接邻居。</div>
          )}
        </div>
      ),
    };
  },
};

const panelBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const panelEyebrowStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 14,
  fontWeight: 700,
};

const summaryStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 12,
  lineHeight: 1.5,
};

const neighborButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  background: "var(--dsw-alias-bg-layer-2, #eef1f4)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  borderRadius: 12,
  cursor: "pointer",
};

const controlButtonStyle: CSSProperties = {
  padding: "7px 10px",
  background: "var(--dsw-alias-bg-layer-2, #eef1f4)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  borderRadius: 10,
  color: "var(--dsw-alias-label-primary, #1f2328)",
  cursor: "pointer",
  fontSize: 12,
};

const swatchStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  flexShrink: 0,
};

const rowTitleStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 13,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowMetaStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 12,
};

const emptyTextStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12,
  lineHeight: 1.5,
};
