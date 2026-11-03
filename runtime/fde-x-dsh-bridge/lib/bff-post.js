const { homedir } = require('node:os')
const { join } = require('node:path')

function bffPageOrigin(env = process.env) {
  const port = String(env.FDE_RUNTIME_PORT || '4318')
  const allowed = String(env.FDE_ALLOWED_ORIGINS || '')
  const http = allowed.split(',').map((value) => value.trim()).find((value) => (
    /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(value)
  ))
  return http || `http://127.0.0.1:${port}`
}

function bffTokenHome(env = process.env) {
  return env.FDE_DSH_HOME || env.DSH_HOME || join(homedir(), '.dsh-fde-x')
}

module.exports = { bffPageOrigin, bffTokenHome }
