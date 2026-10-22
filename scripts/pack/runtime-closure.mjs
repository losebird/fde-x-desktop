import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import ts from 'typescript'

function stageImportError(message) {
  const error = new Error(message)
  error.code = 'ERR_STAGE_UNRESOLVED_IMPORT'
  return error
}

function isInside(file, root) {
  const rel = relative(root, file)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function isCollectedTest(file, root) {
  const rel = relative(root, file)
  if (rel === 'tests') return true
  return rel.split(/[/\\]/u).includes('tests')
}

function staticRelativeSpecifiers(file, source) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const specs = []
  function visit(node) {
    const declaration = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
    if (declaration && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text
      if (spec.startsWith('.')) specs.push(spec)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return specs
}

export function escapedRuntimeImports(root) {
  const runtimeRoot = join(root, 'runtime')
  const entry = join(runtimeRoot, 'server.mjs')
  if (!existsSync(entry) || !statSync(entry).isFile()) {
    throw stageImportError('stage: runtime/server.mjs is missing')
  }
  const seen = new Set()
  const extra = new Set()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()
    if (seen.has(file)) continue
    seen.add(file)
    if (isCollectedTest(file, root)) continue
    if (!statSync(file).isFile()) continue
    if (!/\.(?:mjs|cjs|js)$/u.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const spec of staticRelativeSpecifiers(file, source)) {
      const target = resolve(dirname(file), spec)
      const present = existsSync(target) && statSync(target).isFile()
      if (!present) {
        throw stageImportError(`stage: unresolved relative import ${spec} from ${relative(root, file)}`)
      }
      if (isCollectedTest(target, root)) continue
      if (!isInside(target, runtimeRoot)) {
        if (!isInside(target, root)) {
          throw stageImportError(`stage: relative import leaves the repo ${spec} from ${relative(root, file)}`)
        }
        extra.add(target)
      }
      queue.push(target)
    }
  }
  return [...extra].sort()
}
