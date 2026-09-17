export type JsonSchemaLite = {
  type?: string
  required?: string[]
  enum?: unknown[]
  properties?: Record<string, JsonSchemaLite>
  items?: JsonSchemaLite
}

export type SchemaCheckResult =
  | { ok: true }
  | { ok: false; error: string; path?: string }

function typeOfValue(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

export function validateJsonSchemaLite(value: unknown, schema: JsonSchemaLite, path = ''): SchemaCheckResult {
  if (!schema || typeof schema !== 'object') return { ok: true }
  const t = schema.type
  if (t) {
    const actual = typeOfValue(value)
    const allowed = t === 'integer' ? (actual === 'number' && Number.isInteger(value as number)) : actual === t
    if (!allowed) {
      return { ok: false, error: 'type_mismatch', path: path || '(root)' }
    }
  }
  if (schema.enum && schema.enum.length > 0) {
    if (!schema.enum.some((item) => Object.is(item, value))) {
      return { ok: false, error: 'enum_mismatch', path: path || '(root)' }
    }
  }
  if (schema.type === 'object' || schema.properties) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'expected_object', path: path || '(root)' }
    }
    const record = value as Record<string, unknown>
    for (const key of schema.required || []) {
      if (!(key in record)) {
        return { ok: false, error: 'missing_required', path: path ? `${path}.${key}` : key }
      }
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in record) {
        const nested = validateJsonSchemaLite(record[key], child, path ? `${path}.${key}` : key)
        if (!nested.ok) return nested
      }
    }
  }
  if (schema.type === 'array' || schema.items) {
    if (!Array.isArray(value)) {
      return { ok: false, error: 'expected_array', path: path || '(root)' }
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        const nested = validateJsonSchemaLite(value[i], schema.items, `${path}[${i}]`)
        if (!nested.ok) return nested
      }
    }
  }
  return { ok: true }
}
