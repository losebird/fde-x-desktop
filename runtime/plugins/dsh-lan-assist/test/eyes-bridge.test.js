import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEyesSee, hasEyes } from '../eyes-bridge.js'

test('hasEyes is false without see_file / see_image tools', () => {
  assert.equal(hasEyes({}), false)
  assert.equal(hasEyes({ tools: { get: () => undefined } }), false)
})

test('see uses see_image for a png and see_file otherwise', async () => {
  const calls = []
  const tools = {
    get(name) {
      if (name === 'see_image') {
        return {
          execute: async (args) => {
            calls.push(['image', args.image && args.image.slice(0, 22)])
            return '图上是一张小图'
          },
        }
      }
      if (name === 'see_file') {
        return {
          execute: async (args) => {
            calls.push(['file', args.file])
            return '这是一份 PDF'
          },
        }
      }
      return undefined
    },
  }
  const see = createEyesSee({ tools })
  assert.equal(hasEyes({ tools }), true)
  const png = await see({
    attachments: [{ name: 'tiny.png', mime: 'image/png', data: Buffer.from('hi').toString('base64') }],
  })
  assert.equal(png.ok, true)
  assert.equal(png.text, '图上是一张小图')
  assert.equal(calls[0][0], 'image')
  const pdf = await see({
    attachments: [{ name: 'a.pdf', mime: 'application/pdf', data: Buffer.from('%PDF').toString('base64') }],
  })
  assert.equal(pdf.ok, true)
  assert.equal(pdf.text, '这是一份 PDF')
  assert.equal(calls[1][0], 'file')
})

test('eyes failure text is unseen, not a successful look', async () => {
  const see = createEyesSee({
    tools: {
      get(name) {
        return name === 'see_image'
          ? { execute: async () => 'dsh-eyes could not look at this: missing key' }
          : undefined
      },
    },
  })
  const missed = await see({ attachments: [{ name: 'a.png', mime: 'image/png', data: 'aa' }] })
  assert.equal(missed.ok, false)
  assert.equal(missed.error, 'UNSEEN')
})
