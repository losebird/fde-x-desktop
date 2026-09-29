/** Overlay page CORS onto a proxied upstream header map. Drops upstream Allow-Origin. */
export function mergePageCors(upstreamHeaders, pageCors) {
  const headers = { ...(upstreamHeaders || {}) }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'access-control-allow-origin') delete headers[key]
  }
  return { ...headers, ...(pageCors || {}) }
}
