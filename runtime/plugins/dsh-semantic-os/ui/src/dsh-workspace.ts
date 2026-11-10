/** Active Semantic-tab cwd. Mount bind wins until a connected host with data-cwd is in the DOM. */

let boundCwd = ""

function cwdFromElement(el: Element | null): string {
  if (!(el instanceof HTMLElement) || !el.isConnected) return ""
  return el.getAttribute("data-cwd") || ""
}

export function workspaceCwd(): string {
  if (typeof document === "undefined") return boundCwd
  const roots = document.querySelectorAll(".dsos-root")
  for (let i = roots.length - 1; i >= 0; i--) {
    const cwd = cwdFromElement(roots[i])
    if (cwd) return cwd
  }
  const marked = cwdFromElement(document.querySelector(".dsos-root[data-dsos-semantic]"))
  if (marked) return marked
  const any = cwdFromElement(document.querySelector("[data-cwd]"))
  if (any) return any
  return boundCwd
}

export function setWorkspaceCwd(next?: string, _owner?: object): void {
  boundCwd = String(next || "").trim()
}

export function clearWorkspaceCwd(expected?: string, _owner?: object): void {
  if (!expected || boundCwd === expected) boundCwd = ""
}
