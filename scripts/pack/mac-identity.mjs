/** Distribution signing uses Developer ID Application only. Apple Development cannot pass Gatekeeper on other Macs. */

const DEVELOPER_ID = /^Developer ID Application:\s+(.+?)\s+\(([A-Z0-9]+)\)$/u

export function parseCodesigningIdentities(text) {
  const rows = []
  for (const line of String(text || '').split('\n')) {
    const match = line.match(/^\s*\d+\)\s+([0-9A-F]{40})\s+"([^"]+)"/u)
    if (!match) continue
    rows.push({ hash: match[1], name: match[2] })
  }
  return rows
}

export function pickDeveloperIdApplication(identities) {
  for (const row of identities || []) {
    const parsed = DEVELOPER_ID.exec(String(row.name || ''))
    if (!parsed) continue
    return {
      hash: row.hash,
      name: row.name,
      teamId: parsed[2],
    }
  }
  return null
}

export function notarizeEnvPresent(env = process.env) {
  if (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) return true
  if (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) return true
  if (env.APPLE_KEYCHAIN && env.APPLE_KEYCHAIN_PROFILE) return true
  return false
}

export function packMacSignEnv({ identity, env = process.env } = {}) {
  const next = { ...env }
  if (env.CSC_LINK) {
    delete next.CSC_IDENTITY_AUTO_DISCOVERY
    return { mode: 'csc-link', env: next, identity: null }
  }
  if (identity?.name) {
    next.CSC_IDENTITY_AUTO_DISCOVERY = 'true'
    next.CSC_NAME = identity.name
    if (identity.teamId && !next.APPLE_TEAM_ID) next.APPLE_TEAM_ID = identity.teamId
    return { mode: 'developer-id', env: next, identity }
  }
  next.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  return { mode: 'unsigned', env: next, identity: null }
}
