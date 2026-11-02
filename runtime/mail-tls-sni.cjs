'use strict'

const tls = require('node:tls')

function applyServerName(options) {
  if (!options || typeof options !== 'object') return options
  if (options.servername) return options
  const host = typeof options.host === 'string' ? options.host.trim() : ''
  if (host) options.servername = host
  return options
}

const originalConnect = tls.connect
tls.connect = function patchedTlsConnect(...args) {
  if (typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) applyServerName(args[0])
  else if (typeof args[1] === 'object' && args[1] !== null) applyServerName(args[1])
  else if (typeof args[2] === 'object' && args[2] !== null) applyServerName(args[2])
  return originalConnect.apply(this, args)
}

module.exports = { applyServerName }
