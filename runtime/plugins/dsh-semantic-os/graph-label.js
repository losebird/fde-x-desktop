/**
 * Hide leftover English-NER junk from product graph lists.
 * Keep the sidecar store intact; only filter what the kitchen sees.
 */
const ENTITY_REPR = /^\s*Entity\s*\(/
const JUNK_TYPES = new Set(['UNKNOWN', 'entity', 'Entity', 'DATE', 'PERSON'])

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isEntityRepr(value) {
  return typeof value === 'string' && ENTITY_REPR.test(value)
}

export function shouldHideOnCanvas(node) {
  if (!node || typeof node !== 'object') return true
  const id = asText(node.id)
  if (!id) return true
  const props = node.properties && typeof node.properties === 'object' ? node.properties : {}
  const content = asText(node.content) || asText(props.content)
  if (isEntityRepr(id) || isEntityRepr(content)) return true
  return JUNK_TYPES.has(asText(node.type))
}

export function cleanGraphPayload(body) {
  if (!body || typeof body !== 'object') return body
  const next = Array.isArray(body) ? body.filter((node) => !shouldHideOnCanvas(node)) : { ...body }
  if (Array.isArray(body)) return next
  if (Array.isArray(next.nodes)) {
    next.nodes = next.nodes.filter((node) => !shouldHideOnCanvas(node))
  }
  if (Array.isArray(next.results)) {
    next.results = next.results.filter((item) => {
      const node = item && typeof item === 'object' && item.node ? item.node : item
      return !shouldHideOnCanvas(node)
    })
  }
  return next
}
