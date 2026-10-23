import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(root, 'src')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function exportNames(source) {
  const names = new Set()
  const patterns = [
    /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm,
    /^export\s+const\s+([A-Za-z0-9_]+)/gm,
    /^export\s+class\s+([A-Za-z0-9_]+)/gm,
    /^export\s+\{([^}]+)\}/gm,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (pattern === patterns[3]) {
        for (const part of match[1].split(',')) {
          const piece = part.trim()
          if (!piece) continue
          const alias = piece.split(/\s+as\s+/i).pop().trim()
          if (/^[A-Za-z0-9_]+$/.test(alias)) names.add(alias)
        }
      } else {
        names.add(match[1])
      }
    }
  }
  return names
}

function addExportList(names, list) {
  for (const part of list.split(',')) {
    const piece = part.trim()
    if (!piece) continue
    const alias = piece.split(/\s+as\s+/i).pop().trim()
    if (/^[A-Za-z0-9_]+$/.test(alias)) names.add(alias)
  }
}

function declaredNames(source) {
  const names = new Set()
  for (const match of source.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)) names.add(match[1])
  for (const match of source.matchAll(/^export\s+(?:const|let|class|type|interface)\s+([A-Za-z0-9_]+)/gm)) names.add(match[1])
  for (const match of source.matchAll(/^export\s+\{([^}]+)\}/gm)) addExportList(names, match[1])
  return names
}

const problems = []
const seen = new Set()
const importRe = /from\s+['"](\.[^'"]+\.mjs)['"]/g

for (const file of walk(srcRoot)) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(importRe)) {
    const target = path.normalize(path.resolve(path.dirname(file), match[1]))
    if (!target.startsWith(`${path.join(root, 'runtime')}${path.sep}`)) continue
    if (seen.has(target)) continue
    seen.add(target)
    const decl = target.replace(/\.mjs$/, '.d.mts')
    let declText = ''
    try {
      declText = readFileSync(decl, 'utf8')
    } catch {
      problems.push(`missing ${path.relative(root, decl)} for ${path.relative(root, target)}`)
      continue
    }
    const runtimeText = readFileSync(target, 'utf8')
    const have = declaredNames(declText)
    for (const name of exportNames(runtimeText)) {
      if (!have.has(name)) problems.push(`${path.relative(root, decl)} does not declare ${name}`)
    }
  }
}

if (problems.length) {
  for (const line of problems) console.error(line)
  process.exit(1)
}

console.log(`runtime module declarations cover ${seen.size} imports`)
