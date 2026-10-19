import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { repoRoot } from './lib/drive.mjs'

const iuiSrc = process.env.IUI_SRC || '/tmp/iui-src'
const { createTripAnimatorSource } = await import(
  pathToFileURL(join(iuiSrc, 'src/themes/oiu-design-system.ts')).href
)

const stops = [
  { day: 'D1', name: '西湖' },
  { day: 'D2', name: '灵隐' },
  { day: 'D3', name: '运河' },
]

function bounds(i) {
  return { lt0: i < 0, gteLen: i >= stops.length, at: Object.prototype.hasOwnProperty.call(stops, i) ? stops[i] : undefined }
}

function activate(i) {
  const gate = bounds(i)
  if (gate.lt0 || gate.gteLen) return { skipped: true, ...gate }
  const s = stops[i]
  return { skipped: false, day: s.day }
}

const frames = []
const windowStub = {
  matchMedia() {
    return { matches: true }
  },
  addEventListener() {},
  removeEventListener() {},
}
const documentStub = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll() {
    return []
  },
}
windowStub.document = documentStub

const factory = new Function(
  'window',
  'document',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'clearTimeout',
  `${createTripAnimatorSource()}\nreturn createTripAnimator;`,
)
const createTripAnimator = factory(
  windowStub,
  documentStub,
  () => 1,
  () => {},
  () => 1,
  () => {},
)

let thrown = null
try {
  createTripAnimator({
    stopCount: stops.length,
    durationMs: 6000,
    pinElements: [],
    map: null,
    onFrame(i) {
      frames.push({
        typeofArg: typeof i,
        keys: i && typeof i === 'object' ? Object.keys(i) : [],
        ...bounds(i),
      })
      activate(i)
    },
  })
} catch (error) {
  thrown = { name: error.name, message: error.message }
}

const report = {
  source: 'createTripAnimatorSource() at IUI pin, stub DOM, no browser',
  numericActivate: activate(0),
  frames,
  thrown,
  readingDay: Boolean(thrown && thrown.message.includes("reading 'day'")),
}
const outDir = join(repoRoot, 'artifacts', 'iui-perf', 'day')
await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'onframe-stub.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (!report.readingDay) process.exitCode = 1
