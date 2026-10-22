import type { CSSProperties } from "react";

import type {
  GraphAnalyticsSnapshot,
  GraphDiagnosticsSnapshot,
  GraphEffectAvailability,
  GraphEffectToggle,
} from "../types";
import type { GraphPlugin } from "./types";

const EFFECTS_PANEL_ID = "effects-panel";

type EffectRowConfig = {
  key: GraphEffectToggle;
  label: string;
  description: string;
};

const SCENE_EFFECT_ROWS: EffectRowConfig[] = [
  {
    key: "pathPulseEnabled",
    label: "路径脉冲",
    description: "在当前选中路径上播放脉冲。",
  },
  {
    key: "pathFlowEnabled",
    label: "路径流",
    description: "沿当前选中路径显示方向流动。",
  },
  {
    key: "lensEnabled",
    label: "邻域镜",
    description: "突出悬停或选中节点的局部邻域。",
  },
  {
    key: "temporalEmphasisEnabled",
    label: "时间强调",
    description: "给当前时间窗里相关的节点加微光。",
  },
  {
    key: "semanticRegionsEnabled",
    label: "语义区",
    description: "给最明显的主题簇画淡语义轮廓。",
  },
  {
    key: "contoursEnabled",
    label: "轮廓",
    description: "给最明显的锚点加低对比密度光晕。",
  },
  {
    key: "legendEnabled",
    label: "区域摘要",
    description: "在图分析面板里保留区域和信号摘要。",
  },
];

const INTELLIGENCE_EFFECT_ROWS: EffectRowConfig[] = [
  {
    key: "pathfindingEnabled",
    label: "最短路",
    description: "把追踪路径和局部有向最短路对比。",
  },
  {
    key: "communitiesEnabled",
    label: "社区",
    description: "用 Louvain 检测稳定社区，方便分组。",
  },
  {
    key: "centralityEnabled",
    label: "中心度",
    description: "按中心度排出最强锚点，用于标签和导航。",
  },
];

const AVAILABILITY_KEYS: Record<GraphEffectToggle, keyof GraphDiagnosticsSnapshot["effectAvailability"]> = {
  pathPulseEnabled: "pathPulse",
  pathFlowEnabled: "pathFlow",
  lensEnabled: "lens",
  temporalEmphasisEnabled: "temporalEmphasis",
  semanticRegionsEnabled: "semanticRegions",
  contoursEnabled: "contours",
  pathfindingEnabled: "pathfinding",
  communitiesEnabled: "communities",
  centralityEnabled: "centrality",
  legendEnabled: "legend",
  diagnosticsEnabled: "diagnostics",
};

function renderAvailabilityText(availability: GraphEffectAvailability) {
  if (availability.available) {
    if (typeof availability.visibleSegments === "number" && typeof availability.segmentCap === "number") {
      return `${availability.reason} - ${availability.visibleSegments}/${availability.segmentCap} segments`;
    }
    return availability.reason;
  }

  return availability.detail ? `${availability.reason} - ${availability.detail}` : availability.reason;
}

function collectFallbackLegendItems(context: Parameters<NonNullable<GraphPlugin["renderPanel"]>>[0]) {
  const groups = new Map<string, { count: number; color: string }>();
  context.graph.forEachNode((_nodeId, attrs) => {
    const semanticGroup = String(attrs.semanticGroup || attrs.nodeType || "entity");
    const color = String(attrs.baseColor || context.theme.palette.semantic[0]);
    const current = groups.get(semanticGroup);
    groups.set(semanticGroup, {
      count: (current?.count ?? 0) + 1,
      color,
    });
  });

  return [...groups.entries()]
    .map(([group, data]) => ({ group, ...data }))
    .sort((left, right) => right.count - left.count)
    .slice(0, context.theme.effects.legend.maxGroups);
}

function resolveAvailability(
  availabilityMap: GraphDiagnosticsSnapshot["effectAvailability"] | undefined,
  key: GraphEffectToggle,
  enabled: boolean,
): GraphEffectAvailability {
  return availabilityMap?.[AVAILABILITY_KEYS[key]] ?? {
    enabled,
    available: false,
    reason: "Waiting for graph runtime",
  };
}

function EffectToggleRow({
  label,
  description,
  checked,
  availability,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  availability: GraphEffectAvailability;
  onToggle: () => void;
}) {
  return (
    <div style={toggleRowStyle}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={rowTitleStyle}>{label}</div>
        <div style={rowDescriptionStyle}>{description}</div>
        <div style={rowMetaStyle}>{renderAvailabilityText(availability)}</div>
      </div>
      <button
        type="button"
        className={checked ? "dsos-effect-toggle is-on" : "dsos-effect-toggle"}
        onClick={onToggle}
        style={checked ? toggleButtonActiveStyle : toggleButtonStyle}
      >
        {checked ? "开" : "关"}
      </button>
    </div>
  );
}

function renderRegionsAndSignals(
  context: Parameters<NonNullable<GraphPlugin["renderPanel"]>>[0],
  analytics: GraphAnalyticsSnapshot | null,
) {
  const fallbackLegendItems = collectFallbackLegendItems(context);
  const semanticRegions = analytics?.semanticRegions.summaries ?? [];
  const communities = analytics?.communities.summaries ?? [];
  const centrality = analytics?.centrality.topNodes ?? [];
  const directedPath = analytics?.directedPath ?? null;

  if (!semanticRegions.length && !communities.length && !centrality.length && !fallbackLegendItems.length && !directedPath) {
    return <div style={emptyTextStyle}>图分析就绪后会填区域和智能摘要。</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {semanticRegions.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>语义区</div>
          {semanticRegions.map((region) => (
            <div key={region.semanticGroup} style={legendRowStyle}>
              <span
                style={{
                  ...legendSwatchStyle,
                  background: region.color,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 14px ${region.color}40`,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{region.semanticGroup}</div>
                <div style={rowMetaStyle}>
                  {region.visibleNodeCount.toLocaleString()} 可见 / {region.nodeCount.toLocaleString()} 个
                </div>
              </div>
              <div style={signalBadgeStyle}>{region.anchorLabel}</div>
            </div>
          ))}
        </div>
      ) : null}

      {communities.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>社区锚点</div>
          {communities.slice(0, 3).map((community) => (
            <div key={community.communityId} style={signalRowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{community.anchorLabel}</div>
                <div style={rowMetaStyle}>
                  社区 {community.communityId} · {community.visibleNodeCount} 可见 / {community.nodeCount} 个
                </div>
              </div>
              <div style={signalBadgeStyle}>{community.dominantSemanticGroup}</div>
            </div>
          ))}
        </div>
      ) : null}

      {centrality.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>中心度前列</div>
          {centrality.slice(0, 3).map((node) => (
            <div key={node.id} style={signalRowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{node.label}</div>
                <div style={rowMetaStyle}>
                  {node.semanticGroup} · 分数 {Number(node.score || 0).toFixed(3)}
                </div>
              </div>
              <div style={signalBadgeStyle}>度 {Number(node.degree || 0).toFixed(3)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {directedPath ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>最短路</div>
          <div style={signalRowStyle}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={rowTitleStyle}>{directedPath.ready ? "局部有向路径已就绪" : "等待路径上下文"}</div>
              <div style={rowMetaStyle}>{directedPath.reason}</div>
            </div>
            {directedPath.ready ? (
              <div style={signalBadgeStyle}>
                {directedPath.length} 跳{directedPath.verifiedAgainstActivePath ? " · 一致" : ""}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!semanticRegions.length && !communities.length && !centrality.length && fallbackLegendItems.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>备用语义图例</div>
          {fallbackLegendItems.map((item) => (
            <div key={item.group} style={legendRowStyle}>
              <span
                style={{
                  ...legendSwatchStyle,
                  background: item.color,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 14px ${item.color}40`,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{item.group}</div>
                <div style={rowMetaStyle}>{item.count.toLocaleString()} 个节点</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const explorationEffectsPluginPhaseC: GraphPlugin = {
  id: "exploration-effects",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "effects-toggle",
      label: "图分析",
      title: "打开图分析：最短路、社区、中心度",
      active: context.isPanelOpen(EFFECTS_PANEL_ID),
      order: 18,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: EFFECTS_PANEL_ID }),
    },
  ],
  renderPanel: (context) => {
    if (!context.isPanelOpen(EFFECTS_PANEL_ID)) {
      return null;
    }

    const effectsState = context.getEffectsState();
    const diagnosticsSnapshot = context.getDiagnosticsSnapshot();
    const analyticsSnapshot = context.getAnalyticsSnapshot();
    const availability = diagnosticsSnapshot?.effectAvailability;
    const showSignalsSection =
      effectsState.legendEnabled
      || effectsState.semanticRegionsEnabled
      || effectsState.communitiesEnabled
      || effectsState.centralityEnabled
      || effectsState.pathfindingEnabled;

    return {
      id: EFFECTS_PANEL_ID,
      title: "图分析",
      placement: "bottom",
      order: 8,
      defaultOpen: false,
      preferredWidth: 460,
      preferredHeight: 360,
      content: (
        <div style={panelBodyStyle}>
          <div style={panelEyebrowStyle}>探索效果</div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>场景效果</div>
            {SCENE_EFFECT_ROWS.map((row) => (
              <EffectToggleRow
                key={row.key}
                label={row.label}
                description={row.description}
                checked={effectsState[row.key]}
                availability={resolveAvailability(availability, row.key, effectsState[row.key])}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: row.key })}
              />
            ))}
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>图智能</div>
            {INTELLIGENCE_EFFECT_ROWS.map((row) => (
              <EffectToggleRow
                key={row.key}
                label={row.label}
                description={row.description}
                checked={effectsState[row.key]}
                availability={resolveAvailability(availability, row.key, effectsState[row.key])}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: row.key })}
              />
            ))}
          </div>

          {showSignalsSection ? (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>区域与信号</div>
              {renderRegionsAndSignals(context, analyticsSnapshot)}
            </div>
          ) : null}

          {import.meta.env.DEV ? (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Diagnostics</div>
              <EffectToggleRow
                label="Dev Diagnostics"
                description="Inspect plugin, interaction, and effect gating state."
                checked={effectsState.diagnosticsEnabled}
                availability={resolveAvailability(availability, "diagnosticsEnabled", effectsState.diagnosticsEnabled)}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: "diagnosticsEnabled" })}
              />
              {effectsState.diagnosticsEnabled && diagnosticsSnapshot ? (
                <details style={detailsStyle}>
                  <summary style={summaryStyle}>Runtime snapshot</summary>
                  <pre style={diagnosticsPreStyle}>
                    {JSON.stringify({ diagnostics: diagnosticsSnapshot, analytics: analyticsSnapshot }, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
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
  color: "#8ea4be",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const sectionTitleStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 13,
  fontWeight: 800,
};

const subsectionTitleStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.05em",
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
};

const rowTitleStyle: CSSProperties = {
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 13,
  fontWeight: 700,
};

const rowDescriptionStyle: CSSProperties = {
  color: "var(--dsw-alias-label-secondary, #3d444d)",
  fontSize: 12,
  lineHeight: 1.45,
};

const rowMetaStyle: CSSProperties = {
  color: "var(--dsw-alias-brand-primary, #0969da)",
  fontSize: 11,
  lineHeight: 1.45,
};

const toggleButtonStyle: CSSProperties = {
  minWidth: 52,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const toggleButtonActiveStyle: CSSProperties = {
  ...toggleButtonStyle,
  background: "var(--dsw-alias-brand-primary, #0969da)",
  border: "1px solid var(--dsw-alias-brand-primary, #0969da)",
  color: "#ffffff",
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
};

const legendSwatchStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  flexShrink: 0,
};

const signalRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
};

const signalBadgeStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "var(--dsw-alias-bg-layer-2, #eef1f4)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const detailsStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
  overflow: "hidden",
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  padding: "10px 12px",
  color: "var(--dsw-alias-label-primary, #1f2328)",
  fontSize: 12,
  fontWeight: 800,
};

const diagnosticsPreStyle: CSSProperties = {
  margin: 0,
  padding: "0 12px 12px",
  color: "var(--dsw-alias-label-secondary, #3d444d)",
  fontSize: 11,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const emptyTextStyle: CSSProperties = {
  color: "var(--dsw-alias-label-secondary, #3d444d)",
  fontSize: 12,
  lineHeight: 1.5,
};
