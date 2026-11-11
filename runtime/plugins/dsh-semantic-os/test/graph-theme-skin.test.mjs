import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('DSH theme keeps official node/edge palettes', () => {
  const src = readFileSync(resolve(new URL('../ui/src/dsh-theme.ts', import.meta.url).pathname), 'utf8')
  assert.equal(src.includes('GRAPH_THEME.palette.semantic'), false)
  assert.match(src, /GRAPH_THEME\.palette\.overview\.edgeBackbone/)
  assert.match(src, /backgroundSampleRate = 1/)
  assert.match(src, /minVisibleSamples = 3/)
  assert.match(src, /contours\.glowAlpha = 0\.28/)
  assert.match(src, /GRAPH_THEME\.ui\.control/)
  assert.match(src, /GRAPH_THEME\.ui\.surface\.stage/)
})

test('semantic region labels use the FDE chip and stay off nodes', () => {
  const layers = readFileSync(resolve(new URL('../ui/src/workspaces/GraphWorkspace/graphSceneLayers.ts', import.meta.url).pathname), 'utf8')
  assert.equal(layers.includes('rgba(8, 14, 24, 0.84)'), false)
  assert.match(layers, /GRAPH_THEME\.labels\.chip/)
  assert.match(layers, /placeRegionLabel/)
  const theme = readFileSync(resolve(new URL('../ui/src/workspaces/GraphWorkspace/graphTheme.ts', import.meta.url).pathname), 'utf8')
  assert.match(theme, /hovered: \{ color: "hovered".*forceLabel: false/)
  assert.match(theme, /chip:[\s\S]*background: "#f6f8fa"/)
})
