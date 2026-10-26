export function sanitizeOfficeHtml(html) {
  let out = String(html || '')
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
  out = out.replace(/<object\b[\s\S]*?<\/object>/gi, '')
  out = out.replace(/<embed\b[^>]*>/gi, '')
  out = out.replace(/<link\b[^>]*>/gi, '')
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  out = out.replace(/javascript:/gi, '')
  return out
}
