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

  GRAPH_THEME.palette.background.canvas = bg;
  GRAPH_THEME.palette.background.shell = layer1;
  GRAPH_THEME.palette.background.shellBorder = border;
  GRAPH_THEME.palette.background.shellGlow = "transparent";
  GRAPH_THEME.palette.background.vignette = "transparent";
  GRAPH_THEME.palette.background.nodeBorder = layer2;
  GRAPH_THEME.palette.accent.selected = brand;
  GRAPH_THEME.palette.accent.path = brand;
  GRAPH_THEME.ui.text.strong = text;
  GRAPH_THEME.ui.text.body = text;
  GRAPH_THEME.ui.text.muted = text;
  GRAPH_THEME.ui.text.subtle = text;
  GRAPH_THEME.ui.text.inverse = bg;
  GRAPH_THEME.ui.surface.app = bg;
  GRAPH_THEME.ui.surface.stage = bg;
  GRAPH_THEME.ui.surface.card = layer1;
  GRAPH_THEME.ui.surface.cardSubtle = layer1;
  GRAPH_THEME.ui.surface.cardStrong = layer2;
  GRAPH_THEME.ui.surface.panel = layer1;
  GRAPH_THEME.ui.surface.panelBorder = border;
  GRAPH_THEME.ui.surface.divider = border;
  GRAPH_THEME.ui.surface.shadow = "none";
  GRAPH_THEME.ui.scene.background = bg;
  GRAPH_THEME.ui.scene.radialGlow = "none";
  GRAPH_THEME.ui.scene.vignette = "none";
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
}
