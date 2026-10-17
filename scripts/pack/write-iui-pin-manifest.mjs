#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PLUGIN_PIN_FILE } from '../../runtime/plugin-vendor.mjs'
import { collectPackedFileShas } from './iui-artifact.mjs'
import { IUI_PIN } from './pins.mjs'

const tree = process.argv[2]
if (!tree) {
  console.error('usage: node scripts/pack/write-iui-pin-manifest.mjs <packed-tree>')
  process.exit(1)
}

const pin = JSON.parse(await readFile(join(tree, PLUGIN_PIN_FILE), 'utf8'))
if (pin.commit !== IUI_PIN.commit) {
  throw new Error(`tree ${PLUGIN_PIN_FILE} commit ${pin.commit} does not match pins.mjs ${IUI_PIN.commit}`)
}

const packed = collectPackedFileShas(tree)
const files = Object.fromEntries(Object.keys(packed).sort().map((key) => [key, packed[key]]))
const manifest = {
  artifactSha256: IUI_PIN.artifact.sha256,
  files,
}
const target = new URL('./iui-pin-manifest.json', import.meta.url)
await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`wrote ${Object.keys(files).length} files`)
console.log(`artifactSha256 ${manifest.artifactSha256}`)
console.log(`pin file ${files[PLUGIN_PIN_FILE]}`)
