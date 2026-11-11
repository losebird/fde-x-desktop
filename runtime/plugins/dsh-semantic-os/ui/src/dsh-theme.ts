import { GRAPH_THEME } from "./workspaces/GraphWorkspace/graphTheme";

function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function applyDshGraphTheme() {
  const bg = token("--dsw-alias-bg-base", "#ffffff");
  const layer1 = token("--dsw-alias-bg-layer-1", "#f6f8fa");
  const layer2 = token("--dsw-alias-bg-layer-2", "#eef1f4");
  const text = token("--dsw-alias-label-primary", "#1f2328");
  const secondary = token("--dsw-alias-label-secondary", "#3d444d");
  const muted = `color-mix(in srgb, ${text} 82%, ${secondary})`;
  const brand = token("--dsw-alias-brand-primary", "#0969da");
  const border = token("--dsw-alias-border-l2", "rgba(31,35,40,0.15)");
  const onBrand = token("--dsw-alias-label-primary-foreground", "")
    || token("--dsw-alias-label-on-primary", "")
    || token("--dsw-alias-label-on-brand", "")
    || "#ffffff";

  // Paper matches FDE Memory. Node/edge/effect palettes stay official Semantica.
  GRAPH_THEME.palette.background.canvas = bg;
  GRAPH_THEME.ui.surface.app = bg;
  GRAPH_THEME.ui.surface.stage = bg;
  GRAPH_THEME.ui.scene.background = bg;
  GRAPH_THEME.ui.scene.vignette = "none";
  GRAPH_THEME.ui.text.strong = text;
  GRAPH_THEME.ui.text.body = text;
  GRAPH_THEME.ui.text.muted = muted;
  GRAPH_THEME.ui.text.subtle = muted;
  GRAPH_THEME.ui.text.inverse = bg;
  GRAPH_THEME.ui.surface.card = layer1;
  GRAPH_THEME.ui.surface.cardSubtle = layer1;
  GRAPH_THEME.ui.surface.cardStrong = layer2;
  GRAPH_THEME.ui.surface.panel = layer1;
  GRAPH_THEME.ui.surface.panelBorder = border;
  GRAPH_THEME.ui.surface.divider = border;
  GRAPH_THEME.ui.control.defaultBg = layer2;
  GRAPH_THEME.ui.control.defaultBorder = border;
  GRAPH_THEME.ui.control.defaultText = text;
  GRAPH_THEME.ui.control.hoverBg = layer1;
  GRAPH_THEME.ui.control.activeBg = layer2;
  GRAPH_THEME.ui.control.activeBorder = brand;
  GRAPH_THEME.ui.control.activeText = text;
  GRAPH_THEME.ui.control.primaryBg = brand;
  GRAPH_THEME.ui.control.primaryBorder = brand;
  GRAPH_THEME.ui.control.primaryText = onBrand;
  GRAPH_THEME.ui.control.inputBg = bg;
  GRAPH_THEME.ui.control.inputBorder = border;
  GRAPH_THEME.ui.control.focusRing = brand;
  GRAPH_THEME.ui.timeline.background = layer1;
  GRAPH_THEME.ui.timeline.border = border;
  GRAPH_THEME.ui.timeline.text = text;
  GRAPH_THEME.ui.timeline.textStrong = text;
  GRAPH_THEME.ui.timeline.playhead = brand;
  GRAPH_THEME.labels.chip.background = layer1;
  GRAPH_THEME.labels.chip.borderColor = border;
  GRAPH_THEME.labels.chip.textColor = text;
  GRAPH_THEME.labels.hoverCard.background = layer1;
  GRAPH_THEME.labels.hoverCard.borderColor = border;
  GRAPH_THEME.labels.hoverCard.textColor = text;
  GRAPH_THEME.labels.hoverCard.metaColor = muted;

  // Official edge alphas were for a dark HUD (~2–8%). On FDE paper they vanish.
  GRAPH_THEME.palette.overview.edgeBackbone = "rgba(31, 35, 40, 0.48)";
  GRAPH_THEME.palette.overview.edgeStructure = "rgba(31, 35, 40, 0.32)";
  GRAPH_THEME.palette.overview.edgeInspection = "rgba(9, 105, 218, 0.42)";
  GRAPH_THEME.palette.muted.edgeOverview = "rgba(31, 35, 40, 0.2)";
  GRAPH_THEME.palette.muted.edgeStructure = "rgba(31, 35, 40, 0.24)";
  GRAPH_THEME.palette.muted.edgeInspection = "rgba(31, 35, 40, 0.28)";
  GRAPH_THEME.palette.muted.edgeFocus = "rgba(9, 105, 218, 0.5)";
  GRAPH_THEME.palette.accent.path = "#C45A12";
  GRAPH_THEME.palette.accent.hovered = "#0550AE";
  const full = GRAPH_THEME.edges.visibility.full;
  for (const tier of [full.overview, full.structure, full.inspection]) {
    tier.defaultAlpha = Math.max(tier.defaultAlpha, 0.36);
    tier.mutedAlpha = Math.max(tier.mutedAlpha, 0.14);
    tier.inactiveAlpha = Math.max(tier.inactiveAlpha, 0.1);
    tier.neighborAlpha = Math.max(tier.neighborAlpha, 0.55);
    tier.backgroundSampleRate = 1;
    tier.hideMuted = false;
    tier.sizeMultiplier = Math.max(tier.sizeMultiplier, 0.9);
  }
  GRAPH_THEME.edges.states.default.minSize = Math.max(GRAPH_THEME.edges.states.default.minSize, 0.7);
  GRAPH_THEME.edges.states.backbone.minSize = Math.max(GRAPH_THEME.edges.states.backbone.minSize, 0.9);

  const regions = GRAPH_THEME.effects.semanticRegions;
  regions.minVisibleSamples = 3;
  regions.minMaskPixels = 16;
  regions.outerContourMinMaskPixels = 20;
  regions.minOccupancyRatio = 0.00005;
  regions.fogAlpha = 0.28;
  regions.innerContourAlpha = 0.48;
  regions.outerContourAlpha = 0.22;
  GRAPH_THEME.effects.contours.glowAlpha = 0.28;
  GRAPH_THEME.effects.temporalEmphasis.glowAlpha = 0.28;
  GRAPH_THEME.effects.lens.glowAlpha = 0.32;
}
