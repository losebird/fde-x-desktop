/**
 * Pairing codes, shared keys, envelope lock. Not a website certificate.
 * @module dsh-lan-assist/crypto
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto'

export function randomHex(bytes = 16) {
  return randomBytes(bytes).toString('hex')
}

export function mintPeerId(prefix = 'pk') {
  return `${prefix}_${randomHex(8)}`
}

export function sixDigitCode() {
  const n = randomBytes(4).readUInt32BE(0) % 900000
  return String(100000 + n)
}

/**
 * Both sides know both codes after handshake. Order is canonical so A and B
 * derive the same key without sending the key itself.
 * @param {{ idA: string, idB: string, codeA: string, codeB: string }} parts
 */
export function deriveSharedKey(parts) {
  const { idA, idB, codeA, codeB } = parts
  const left = idA < idB ? idA : idB
  const right = idA < idB ? idB : idA
  const cLeft = idA < idB ? codeA : codeB
  const cRight = idA < idB ? codeB : codeA
  return createHash('sha256')
    .update(`dsh-lan-assist-v1\0${left}\0${right}\0${cLeft}\0${cRight}`)
    .digest()
}

/**
 * Ephemeral X25519 offer. Public half may ride the wire; private half stays here.
 */
export function generatePairOffer() {
  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  }
}

export function pairSharedSecret(myPrivateB64, theirPublicB64) {
  const privateKey = createPrivateKey({
    key: Buffer.from(String(myPrivateB64 || ''), 'base64'),
    type: 'pkcs8',
    format: 'der',
  })
  const publicKey = createPublicKey({
    key: Buffer.from(String(theirPublicB64 || ''), 'base64'),
    type: 'spki',
    format: 'der',
  })
  return diffieHellman({ privateKey, publicKey })
}

/**
 * Spoken six digits mix into the DH secret. The digits never ride the wire,
 * and a transcript without a private key cannot be checked against a guess.
 */
export function derivePairedKey({ shared, spokenCode, idA, idB, nonce }) {
  const left = String(idA || '') < String(idB || '') ? idA : idB
  const right = String(idA || '') < String(idB || '') ? idB : idA
  return Buffer.from(hkdfSync(
    'sha256',
    shared,
    String(nonce || ''),
    `dsh-lan-assist-pair-v3\0${left}\0${right}\0${spokenCode}`,
    32,
  ))
}

export function keyFromHex(hex) {
  const buf = Buffer.from(String(hex || ''), 'hex')
  if (buf.length !== 32) throw new Error('bad shared key')
  return buf
}

export function encryptJson(key, obj) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const pt = Buffer.from(JSON.stringify(obj), 'utf8')
  const ct = Buffer.concat([cipher.update(pt), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ct: ct.toString('hex'),
  }
}

export function decryptJson(key, box) {
  if (!box || typeof box !== 'object') throw new Error('bad box')
  const iv = Buffer.from(String(box.iv || ''), 'hex')
  const tag = Buffer.from(String(box.tag || ''), 'hex')
  const ct = Buffer.from(String(box.ct || ''), 'hex')
  if (iv.length !== 12 || tag.length !== 16) throw new Error('bad box')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(pt.toString('utf8'))
}

export function macHex(key, text) {
  return createHmac('sha256', key).update(String(text)).digest('hex')
}

export function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || ''), 'hex')
  const right = Buffer.from(String(b || ''), 'hex')
  if (left.length === 0 || left.length !== right.length) return false
  return left.equals(right)
}

/**
 * Sign a LAN frame. `mac` covers the canonical body without itself.
 * @param {Buffer} key
 * @param {Record<string, unknown>} frame
 */
export function signFrame(key, frame) {
  const copy = { ...frame }
  delete copy.mac
  const mac = macHex(key, stableStringify(copy))
  return { ...copy, mac }
}

export function verifyFrame(key, frame) {
  if (!frame || typeof frame !== 'object') return false
  const copy = { ...frame }
  const mac = copy.mac
  delete copy.mac
  return timingSafeEqualHex(macHex(key, stableStringify(copy)), mac)
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

export function seenNonceKey(from, nonce) {
  return `${from}:${nonce}`
}
