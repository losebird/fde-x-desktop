import { readFileSync } from 'node:fs'

const text = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
const errors = []
function indentOf(line) { return line.match(/^\s*/)[0].length }
const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
if (!lines.length) errors.push('empty patch document')

function parseValue(raw) {
  const v = raw.trim()
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~') return null
  if (/^'.*'$/.test(v) || /^".*"$/.test(v)) return v.slice(1, -1)
  return v
}

const stack = []
for (const line of lines) {
  const indent = indentOf(line)
  const content = line.trim()
  const isItem = content.startsWith('- ')
  while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop()
  const keyMatch = content.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/)
  if (isItem) {
    stack.push({ indent, key: null, value: parseValue(content.slice(2)) })
  } else if (keyMatch) {
    stack.push({ indent, key: keyMatch[1], value: parseValue(keyMatch[2]) })
  } else {
    errors.push(`unrecognized line: ${content}`)
  }
}
const rootItems = lines.filter((line) => /^- /.test(line.trim())).map((line) => line.trim().slice(2))
if (!rootItems.length || rootItems[0] !== 'insert:') errors.push('expected root to be an insert patch')
if (!text.includes('id: dsh-semantic-os') || !text.includes('name: dsh-semantic-os')) errors.push('missing dsh-semantic-os id/name')
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('cordis.patch.yml structurally valid')
