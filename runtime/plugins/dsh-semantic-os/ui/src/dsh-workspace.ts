/** Active Semantic-tab cwd. Visible root wins so switching sessions does not keep the last mount. */

export function workspaceCwd(): string {
  if (typeof document === "undefined") return "";
  const roots = document.querySelectorAll(".dsos-root")
  for (let i = 0; i < roots.length; i++) {
    const el = roots[i]
    if (!(el instanceof HTMLElement)) continue
    if (el.offsetParent === null && el.getClientRects().length === 0) continue
    const cwd = el.getAttribute("data-cwd") || ""
    if (cwd) return cwd
  }
  const marked = document.querySelector(".dsos-root[data-dsos-semantic]")
  if (marked) return marked.getAttribute("data-cwd") || ""
  return ""
}

export function setWorkspaceCwd(_next?: string, _owner?: object): void {}

export function clearWorkspaceCwd(_expected?: string, _owner?: object): void {}
