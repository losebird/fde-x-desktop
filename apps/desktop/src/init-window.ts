const CANVAS = '#FAFAFA'
const INK = '#1A1A1A'
const MUTED = '#6B7280'
const LINE = '#ECECE9'
const BRAND = '#2F6B3A'

export function initWindowHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<style>
  html, body { height: 100%; margin: 0; }
  body {
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: ${CANVAS};
    color: ${INK};
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-font-smoothing: antialiased;
  }
  .panel { width: 300px; }
  .mark {
    width: 32px; height: 32px; border-radius: 8px;
    background: ${BRAND}; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 600;
  }
  h1 { margin: 14px 0 6px; font-size: 16px; font-weight: 600; letter-spacing: -0.02em; }
  #s { margin: 0 0 16px; font-size: 13px; color: ${MUTED}; min-height: 1.4em; }
  .bar { height: 3px; background: ${LINE}; border-radius: 99px; overflow: hidden; }
  .bar > i {
    display: block; height: 100%; width: 36%;
    background: ${BRAND}; border-radius: 99px;
    animation: slide 1.2s ease-in-out infinite;
  }
  @keyframes slide {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(380%); }
  }
</style>
</head>
<body>
  <div class="panel">
    <div class="mark">F</div>
    <h1>正在初始化</h1>
    <p id="s">准备中…</p>
    <div class="bar" aria-hidden="true"><i></i></div>
  </div>
</body>
</html>`
}

export function initWindowDataUrl() {
  return `data:text/html;charset=utf-8,${encodeURIComponent(initWindowHtml())}`
}

export function initWindowSetStepSource(text: string) {
  return `(() => { const el = document.getElementById('s'); if (el) el.textContent = ${JSON.stringify(text)}; })()`
}
