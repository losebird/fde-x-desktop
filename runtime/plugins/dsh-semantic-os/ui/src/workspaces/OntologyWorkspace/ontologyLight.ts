import type { CSSProperties } from "react";

const text = "var(--dsw-alias-label-primary, #1f2328)";
const muted = "color-mix(in srgb, var(--dsw-alias-label-primary, #1f2328) 82%, var(--dsw-alias-label-secondary, #3d444d))";
const border = "var(--dsw-alias-border-l2, rgba(31,35,40,0.15))";
const surface = "var(--dsw-alias-bg-layer-1, #f6f8fa)";
const base = "var(--dsw-alias-bg-base, #fff)";
const accent = "var(--dsw-alias-brand-primary, #0969da)";

export const ontoLight = {
  text,
  muted,
  border,
  surface,
  base,
  accent,
  page: {
    height: "100%",
    overflow: "auto",
    padding: 22,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    background: base,
    color: text,
  } as CSSProperties,
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    padding: 22,
    border: `1px solid ${border}`,
    borderRadius: 22,
    background: surface,
  } as CSSProperties,
  kicker: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    color: accent,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  } as CSSProperties,
  title: {
    margin: "8px 0",
    color: text,
    fontSize: 26,
    letterSpacing: "-0.04em",
  } as CSSProperties,
  copy: {
    margin: 0,
    color: muted,
    lineHeight: 1.6,
    maxWidth: 680,
  } as CSSProperties,
  label: {
    display: "block",
    color: muted,
    fontSize: 11,
    fontWeight: 800,
    margin: "0 0 6px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  } as CSSProperties,
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${border}`,
    borderRadius: 12,
    padding: "10px 12px",
    background: base,
    color: text,
  } as CSSProperties,
  card: {
    padding: 18,
    border: `1px solid ${border}`,
    borderRadius: 20,
    background: surface,
  } as CSSProperties,
  sectionTitle: {
    margin: "0 0 14px",
    color: text,
    fontSize: 16,
  } as CSSProperties,
  primaryButton: {
    border: `1px solid ${accent}`,
    borderRadius: 12,
    padding: "9px 11px",
    background: accent,
    color: "var(--dsw-alias-label-primary-foreground, #fff)",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  } as CSSProperties,
  secondaryButton: {
    border: `1px solid ${border}`,
    borderRadius: 12,
    padding: "9px 11px",
    background: base,
    color: text,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  } as CSSProperties,
  muted: { margin: 0, color: muted, fontSize: 13 } as CSSProperties,
};
