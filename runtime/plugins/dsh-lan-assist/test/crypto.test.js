import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  decryptJson,
  derivePairedKey,
  deriveSharedKey,
  encryptJson,
  generatePairOffer,
  pairSharedSecret,
  signFrame,
  sixDigitCode,
  verifyFrame,
} from '../crypto.js'
import { guessPeerDoor, isPrivateIpv4, sameLanSegment } from '../lan.js'

test('six-digit codes are six digits', () => {
  for (let i = 0; i < 20; i++) {
    assert.match(sixDigitCode(), /^\d{6}$/)
  }
})

test('shared key is order-independent', () => {
  const a = deriveSharedKey({ idA: 'pk_a', idB: 'pk_b', codeA: '111111', codeB: '222222' })
  const b = deriveSharedKey({ idA: 'pk_b', idB: 'pk_a', codeA: '222222', codeB: '111111' })
  assert.equal(a.toString('hex'), b.toString('hex'))
})

test('challenge-response pair key stays off the wire', () => {
  const alice = generatePairOffer()
  const bob = generatePairOffer()
  const sharedA = pairSharedSecret(alice.privateKey, bob.publicKey)
  const sharedB = pairSharedSecret(bob.privateKey, alice.publicKey)
  assert.equal(sharedA.toString('hex'), sharedB.toString('hex'))
  const a = derivePairedKey({ shared: sharedA, spokenCode: '654321', idA: 'pk_a', idB: 'pk_b', nonce: 'n1' })
  const b = derivePairedKey({ shared: sharedB, spokenCode: '654321', idA: 'pk_b', idB: 'pk_a', nonce: 'n1' })
  assert.equal(a.toString('hex'), b.toString('hex'))
  const other = derivePairedKey({ shared: sharedA, spokenCode: '111111', idA: 'pk_a', idB: 'pk_b', nonce: 'n1' })
  assert.notEqual(a.toString('hex'), other.toString('hex'))
  const transcript = JSON.stringify({ offerA: alice.publicKey, offerB: bob.publicKey, nonce: 'n1' })
  assert.doesNotMatch(transcript, /654321/)
  assert.doesNotMatch(alice.publicKey, /654321/)
})

test('envelope lock round-trips and rejects a bad key', () => {
  const key = deriveSharedKey({ idA: 'a', idB: 'b', codeA: '123456', codeB: '654321' })
  const box = encryptJson(key, { body: '先切 10%' })
  assert.equal(decryptJson(key, box).body, '先切 10%')
  const other = deriveSharedKey({ idA: 'a', idB: 'c', codeA: '123456', codeB: '000000' })
  assert.throws(() => decryptJson(other, box))
})

test('frame mac covers the body', () => {
  const key = deriveSharedKey({ idA: 'a', idB: 'b', codeA: '111111', codeB: '222222' })
  const signed = signFrame(key, { type: 'ack', from: 'a', nonce: 'n1' })
  assert.equal(verifyFrame(key, signed), true)
  assert.equal(verifyFrame(key, { ...signed, type: 'reply' }), false)
})

test('private ipv4 is the only shout target', () => {
  assert.equal(isPrivateIpv4('192.168.1.8'), true)
  assert.equal(isPrivateIpv4('10.0.0.2'), true)
  assert.equal(isPrivateIpv4('8.8.8.8'), false)
})

test('guest wifi is another private segment, not the same LAN', () => {
  assert.equal(sameLanSegment('192.168.1.8:9527', '192.168.1.20:9527'), true)
  assert.equal(sameLanSegment('192.168.1.8:9527', '192.168.43.12:9527'), false)
  assert.equal(sameLanSegment('10.0.0.2:9527', '8.8.8.8:9527'), false)
})

test('loopback handshake does not keep a local: doorplate', () => {
  assert.equal(guessPeerDoor('::ffff:127.0.0.1', 'local:9527', 19021), '127.0.0.1:19021')
  assert.equal(guessPeerDoor('::1', '127.0.0.1:19022', 19021), '127.0.0.1:19022')
})
