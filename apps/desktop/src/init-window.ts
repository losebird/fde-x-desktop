export function initWindowHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui;padding:24px"><h2>正在初始化…</h2><p id="s">准备中…</p></body></html>`
}

export function initWindowDataUrl() {
  return `data:text/html;charset=utf-8,${encodeURIComponent(initWindowHtml())}`
}
