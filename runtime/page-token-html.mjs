const TOKEN_RE = /^[0-9a-f]{64}$/u
const META_RE = /<meta name="fde-ui-token" content="[^"]*"\s*\/?>/

export function isPageTokenValue(value) {
  return TOKEN_RE.test(String(value || '').trim())
}

/** Insert or replace the workbench page token. An empty token strips a baked meta. */
export function injectPageTokenHtml(html, token) {
  const source = String(html || '')
  const value = String(token || '').trim()
  if (!TOKEN_RE.test(value)) {
    return source.replace(META_RE, '')
  }
  const meta = `<meta name="fde-ui-token" content="${value}" />`
  if (META_RE.test(source)) return source.replace(META_RE, meta)
  if (source.includes('</head>')) return source.replace('</head>', `${meta}\n</head>`)
  return `${meta}\n${source}`
}
