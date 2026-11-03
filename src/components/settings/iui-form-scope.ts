import type { HostNsEntry } from '@/components/settings/use-host-settings'
import type { SettingsFormPathOp, SettingsFormScope, SettingsFormScopeSnapshot } from '@/components/settings/iui-primitives-shim'

export type IuiSettingsValue = Record<string, unknown>

function asObject(value: unknown): IuiSettingsValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as IuiSettingsValue : {}
}

export function snapshotFromEntry(entry: HostNsEntry, writable: boolean): SettingsFormScopeSnapshot<IuiSettingsValue> {
  const value = asObject(entry.value)
  return {
    status: 'ready',
    value,
    base: entry.base !== undefined ? entry.base : {},
    user: entry.user !== undefined ? entry.user : value,
    writable,
    revision: entry.revision,
  }
}

export function snapshotFromView(view: unknown, writable: boolean): SettingsFormScopeSnapshot<IuiSettingsValue> | null {
  if (!view || typeof view !== 'object') return null
  const row = view as { value?: unknown; base?: unknown; user?: unknown; revision?: unknown }
  const value = asObject(row.value)
  return {
    status: 'ready',
    value,
    base: row.base !== undefined ? row.base : {},
    user: row.user !== undefined ? row.user : value,
    writable,
    revision: typeof row.revision === 'number' ? row.revision : undefined,
  }
}

export function createIuiCatalogScope(initial: SettingsFormScopeSnapshot<IuiSettingsValue>, mutate: SettingsFormScope<IuiSettingsValue>['mutate']): {
  scope: SettingsFormScope<IuiSettingsValue>
  replace: (next: SettingsFormScopeSnapshot<IuiSettingsValue>) => void
} {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    scope: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
      mutate,
    },
    replace: (next) => {
      snapshot = next
      for (const listener of listeners) listener()
    },
  }
}

export function catalogItemView(bag: unknown, ns: string): unknown {
  if (!bag || typeof bag !== 'object') return null
  const row = bag as { mutation?: unknown; items?: Array<{ id?: unknown; fields?: unknown }> }
  if (row.mutation && typeof row.mutation === 'object') return row.mutation
  const hit = Array.isArray(row.items) ? row.items.find((item) => String(item.id || '') === ns) : null
  return hit && typeof hit.fields === 'object' ? hit.fields : null
}

export type { SettingsFormPathOp }
