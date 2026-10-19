export function trimReadToken(value) {
  return String(value ?? '').replace(/^\s+|\s+$/gu, '')
}

export function githubRemoteUrls(repo, token) {
  const cleanUrl = `https://github.com/${repo}.git`
  const trimmed = trimReadToken(token)
  if (!trimmed) return { cleanUrl, fetchUrl: cleanUrl, token: '' }
  return {
    cleanUrl,
    fetchUrl: `https://x-access-token:${encodeURIComponent(trimmed)}@github.com/${repo}.git`,
    token: trimmed,
  }
}

export function redactSecrets(text, token) {
  let out = String(text)
  const trimmed = trimReadToken(token)
  if (trimmed) {
    out = out.split(trimmed).join('[REDACTED]')
    const encoded = encodeURIComponent(trimmed)
    if (encoded !== trimmed) out = out.split(encoded).join('[REDACTED]')
  }
  return out
    .replace(/x-access-token:[^@\s'"]+/giu, 'x-access-token:[REDACTED]')
    .replace(/bearer\s+\S+/giu, 'bearer [REDACTED]')
    .replace(/ghs_[A-Za-z0-9_]+/gu, 'ghs_[REDACTED]')
    .replace(/github_pat_[A-Za-z0-9_]+/gu, 'github_pat_[REDACTED]')
    .replace(/ghp_[A-Za-z0-9_]+/gu, 'ghp_[REDACTED]')
}
