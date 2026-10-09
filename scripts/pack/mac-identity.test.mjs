import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  notarizeEnvPresent,
  packMacSignEnv,
  parseCodesigningIdentities,
  pickDeveloperIdApplication,
} from './mac-identity.mjs'

const listing = `
  1) 18B24246371D1E69F2A81B94C30F7A512071FC9D "Apple Development: 382625007@qq.com (C94Q69QAA7)"
  2) AABBCCDDEEFF00112233445566778899AABBCCDD "Developer ID Application: Example Inc (TEAMID12)"
     2 valid identities found
`

test('parseCodesigningIdentities reads quoted names', () => {
  const rows = parseCodesigningIdentities(listing)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].name.startsWith('Apple Development:'), true)
})

test('pickDeveloperIdApplication ignores Apple Development', () => {
  const onlyDev = parseCodesigningIdentities(`
  1) 18B24246371D1E69F2A81B94C30F7A512071FC9D "Apple Development: 382625007@qq.com (C94Q69QAA7)"
  `)
  assert.equal(pickDeveloperIdApplication(onlyDev), null)
  const picked = pickDeveloperIdApplication(parseCodesigningIdentities(listing))
  assert.equal(picked.teamId, 'TEAMID12')
  assert.match(picked.name, /Developer ID Application/)
})

test('packMacSignEnv unsigned when no distribution identity', () => {
  const packed = packMacSignEnv({ identity: null, env: {} })
  assert.equal(packed.mode, 'unsigned')
  assert.equal(packed.env.CSC_IDENTITY_AUTO_DISCOVERY, 'false')
})

test('packMacSignEnv prefers CSC_LINK over keychain', () => {
  const packed = packMacSignEnv({
    identity: { name: 'Developer ID Application: Example Inc (TEAMID12)', teamId: 'TEAMID12' },
    env: { CSC_LINK: '/tmp/cert.p12' },
  })
  assert.equal(packed.mode, 'csc-link')
  assert.equal(packed.env.CSC_IDENTITY_AUTO_DISCOVERY, undefined)
})

test('notarizeEnvPresent requires a complete triple', () => {
  assert.equal(notarizeEnvPresent({}), false)
  assert.equal(notarizeEnvPresent({ APPLE_ID: 'a@b.c' }), false)
  assert.equal(notarizeEnvPresent({
    APPLE_ID: 'a@b.c',
    APPLE_APP_SPECIFIC_PASSWORD: 'xxxx',
    APPLE_TEAM_ID: 'TEAMID12',
  }), true)
})
