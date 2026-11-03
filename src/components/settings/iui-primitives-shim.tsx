/**
 * Minimal Host settings-form primitives for hanging IUI's settings.section
 * in FDE Settings. The published dsh-client-ui-primitives barrel pulls shiki /
 * katex / simple-icons; IUI only needs SettingsForm, SettingsFormModel, Switch.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import switchCss from './iui-switch.module.css'

export type SettingsFormPathOp = {
  op: 'set'
  path: readonly string[]
  value: unknown
} | {
  op: 'unset'
  path: readonly string[]
}

export interface SettingsFormScopeSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  base: unknown
  user: unknown
  writable: boolean
  revision: number | undefined
}

export interface SettingsFormScope<T> {
  getSnapshot(): SettingsFormScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  mutate(ops: readonly SettingsFormPathOp[], expectedRevision?: number): Promise<boolean>
}

export type SettingsFieldWrite = { kind: 'set'; value: unknown } | { kind: 'clear' }

export interface SettingsFieldSpec {
  field: string
  format: (value: unknown) => string
  parse: (text: string) => SettingsFieldWrite | undefined
}

export interface SettingsSecretSpec {
  field: string
  write: (text: string) => Promise<boolean>
}

export interface SettingsFieldState {
  text: string
  overridden: boolean
  invalid: boolean
}

export interface SettingsFormShell {
  available: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
}

export interface SettingsFormActions {
  edit: (field: string, text: string) => void
  resetField: (field: string) => void
  save: () => void
  discard: () => void
}

export interface SettingsFormLabels {
  unavailable: string
  readOnly: string
  saveFailed: string
  save: string
  saving: string
}

export interface SettingsFormProps {
  labels: SettingsFormLabels
  state: SettingsFormShell
  onSave: () => void
  onDiscard: () => void
  children: ReactNode
}

type SnapshotStore<S> = {
  getSnapshot(): S
  subscribe(listener: () => void): () => void
  set(next: S): void
}

function createSnapshotStore<S>(initial: S): SnapshotStore<S> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      value = next
      for (const listener of listeners) listener()
    },
  }
}

type StagedEdit = { text: string; clear: boolean }

type PlanItem = {
  field: string
  op?: SettingsFormPathOp
  run?: () => Promise<boolean>
}

export function SettingsForm(props: SettingsFormProps) {
  const { state, labels } = props
  const discard = useRef(props.onDiscard)
  discard.current = props.onDiscard
  useEffect(() => () => { discard.current() }, [])
  if (!state.available) {
    return <p role="status">{labels.unavailable}</p>
  }
  const blocked = !state.dirty || state.invalid || state.saving
  return (
    <div>
      {!state.writable ? <p role="status">{labels.readOnly}</p> : null}
      {props.children}
      <div>
        {state.failed ? <p role="status">{labels.saveFailed}</p> : null}
        <button type="button" disabled={blocked} onClick={props.onSave}>
          {state.saving ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  )
}

export class SettingsFormModel<T extends Record<string, unknown>> {
  private readonly scope: SettingsFormScope<T>
  private readonly specs: Map<string, SettingsFieldSpec>
  private readonly secretSpecs: Map<string, SettingsSecretSpec>
  private readonly staged = new Map<string, StagedEdit>()
  private readonly listeners = new Set<() => void>()
  private baseline: SettingsFormScopeSnapshot<T> | undefined
  private readonly unsubscribe: () => void
  private saving = false
  private failed = false

  constructor(scope: SettingsFormScope<T>, specs: SettingsFieldSpec[], secrets: SettingsSecretSpec[] = []) {
    this.scope = scope
    this.specs = new Map(specs.map((spec) => [spec.field, spec]))
    this.secretSpecs = new Map(secrets.map((spec) => [spec.field, spec]))
    this.unsubscribe = scope.subscribe(() => { this.publish() })
  }

  bind<S>(project: () => S): SnapshotStore<S> {
    const store = createSnapshotStore(project())
    this.listeners.add(() => { store.set(project()) })
    return store
  }

  shell(): SettingsFormShell {
    const snapshot = this.scope.getSnapshot()
    const plan = this.plan()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.run === undefined && item.op === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  field(field: string): SettingsFieldState {
    const staged = this.staged.get(field)
    if (this.secretSpecs.has(field)) {
      return { text: staged?.text ?? '', overridden: false, invalid: false }
    }
    const spec = this.spec(field)
    if (staged === undefined) {
      return {
        text: spec.format(this.sectionValue(field)),
        overridden: this.stored(field),
        invalid: false,
      }
    }
    const write = staged.clear ? { kind: 'clear' as const } : spec.parse(staged.text)
    return {
      text: staged.text,
      overridden: write?.kind === 'set',
      invalid: write === undefined,
    }
  }

  actions(): SettingsFormActions {
    return {
      edit: (field, text) => { this.stage(field, { text, clear: false }) },
      resetField: (field) => {
        this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true })
      },
      save: () => { void this.save() },
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return
        this.staged.clear()
        this.baseline = undefined
        this.failed = false
        this.publish()
      },
    }
  }

  async save(): Promise<void> {
    const plan = this.plan()
    if (!plan.length || this.saving || !this.scope.getSnapshot().writable || plan.some((item) => item.run === undefined && item.op === undefined)) return
    this.saving = true
    this.failed = false
    this.publish()
    try {
      const ops = plan.flatMap((item) => (item.op === undefined ? [] : [item.op]))
      let landed = !ops.length || await this.scope.mutate(ops, this.baseline?.revision)
      if (!landed) {
        this.failed = true
        return
      }
      for (const item of plan) if (item.run) landed = await item.run() && landed
      if (landed) {
        this.staged.clear()
        this.baseline = undefined
      }
      this.failed = !landed
    } catch {
      this.failed = true
    } finally {
      this.saving = false
      this.publish()
    }
  }

  dispose(): void {
    this.unsubscribe()
    this.listeners.clear()
  }

  private plan(): PlanItem[] {
    const plan: PlanItem[] = []
    for (const [field, staged] of this.staged) {
      const secret = this.secretSpecs.get(field)
      if (secret !== undefined) {
        const value = staged.text.trim()
        if (value !== '') plan.push({ field, run: () => secret.write(value) })
        continue
      }
      const spec = this.spec(field)
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, op: { op: 'unset', path: [field] } })
        continue
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue
      const write = spec.parse(staged.text)
      if (write === undefined) plan.push({ field })
      else if (write.kind === 'clear') plan.push({ field, op: { op: 'unset', path: [field] } })
      else plan.push({ field, op: { op: 'set', path: [field], value: write.value } })
    }
    return plan
  }

  private stage(field: string, edit: StagedEdit) {
    this.baseline ??= this.scope.getSnapshot()
    this.staged.set(field, edit)
    this.failed = false
    this.publish()
  }

  private spec(field: string) {
    const spec = this.specs.get(field)
    if (spec === undefined) throw new Error(`plugin card has no field ${field}`)
    return spec
  }

  private snapshotOf() {
    return this.scope.getSnapshot()
  }

  private sectionValue(field: string) {
    const value = this.snapshotOf().value
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[field]
  }

  private baseValue(field: string) {
    const base = this.snapshotOf().base
    if (!base || typeof base !== 'object') return undefined
    return (base as Record<string, unknown>)[field]
  }

  private userLayer() {
    return this.snapshotOf().user
  }

  private stored(field: string) {
    const user = this.userLayer()
    return user !== undefined && user !== null && typeof user === 'object' && Object.prototype.hasOwnProperty.call(user, field)
  }

  private publish() {
    for (const listener of this.listeners) listener()
  }
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  title,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={clsx(switchCss.switch, className)}
      onClick={() => { onChange(!checked) }}
    >
      <span className={switchCss.thumb} />
    </button>
  )
}

export function settingsNumberField(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : ''),
    parse: (text) => {
      if (!text) return { kind: 'clear' }
      const n = Number(text)
      return Number.isFinite(n) ? { kind: 'set', value: n } : undefined
    },
  }
}

export function settingsTextField(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'string' ? value : value == null ? '' : String(value)),
    parse: (text) => (text === '' ? { kind: 'clear' } : { kind: 'set', value: text }),
  }
}
