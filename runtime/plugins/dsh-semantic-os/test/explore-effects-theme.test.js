import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relative) {
  return readFileSync(join(root, relative), 'utf8')
}

test('explore dock theme does not force primary text onto effect toggles', () => {
  const files = [
    'ui/src/dsh-theme.css',
    'http.js',
  ]
  for (const relative of files) {
    const css = read(relative)
    assert.equal(
      /\.explore-plugin-dock-body\s+\*[\s\S]{0,120}color\s*:\s*var\(--dsw-alias-label-primary/.test(css),
      false,
      `${relative} paints every dock descendant with primary text, so 开 disappears on a dark toggle`,
    )
  }
})

test('explore legend uses live node types instead of biology fallback', () => {
  const src = read('dist/explore/explore.js')
  assert.match(src, /label: i \}\)/)
  assert.match(src, /label: "节点"/)
  assert.equal(src.includes('Kde.map((i) => ({ key: i.shape, shape: i.shape, label: i.label }))'), false)
})

test('ontology tabs do not mount hidden SHACL and ER workspaces', () => {
  const src = read('dist/ontology/ontology.js')
  assert.match(src, /t === "er" \?/)
  assert.match(src, /t === "hub" \?/)
  assert.equal(src.includes('display: t === "er" ? "contents" : "none"'), false)
})

test('on-state effect toggle keeps a contrasting fill color', () => {
  const css = `${read('ui/src/dsh-theme.css')}\n${read('http.js')}`
  assert.match(css, /\.dsos-effect-toggle\.is-on[\s\S]{0,240}(-webkit-text-fill-color|#fff|#ffffff)/)
})
