export async function readJsonFromRequest(request, opts = {}) {
  const max = Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : 32 * 1024 * 1024
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > max) throw new Error('request_too_large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
