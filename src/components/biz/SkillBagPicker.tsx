import { useState } from 'react'
import { SurfaceButton, SurfaceInput } from '@/components/surface'
import type { FdeAppSkillBind } from '@/lib/app-spec'
import type { SkillBagItem } from '@/lib/runtime-api'

type Props = {
  skills: SkillBagItem[]
  value: FdeAppSkillBind[]
  onChange: (next: FdeAppSkillBind[]) => void
  label?: string
  kit?: boolean
}

export function SkillBagPicker({ skills, value, onChange, label, kit }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const bag = skills.filter((row) => row.path && row.path.startsWith('/'))
  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? bag.filter((row) => row.name.toLowerCase().includes(needle) || String(row.path || '').toLowerCase().includes(needle))
    : bag
  const title = `${open ? '收起 Skills' : (label || '交给 Agent 的 Skills')}${value.length ? ` · ${value.length}` : ''}`

  return (
    <div className={kit ? 'space-y-2' : 'space-y-1 text-xs text-ink-muted'}>
      {kit ? (
        <SurfaceButton type="button" size="sm" onClick={() => setOpen((current) => !current)}>{title}</SurfaceButton>
      ) : (
        <button type="button" className="btn h-7 px-2 text-xs" onClick={() => setOpen((current) => !current)}>{title}</button>
      )}
      {open && (
        <>
          {kit ? (
            <SurfaceInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="过滤名称" />
          ) : (
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="过滤名称" />
          )}
          <div className={kit ? 'max-h-40 space-y-1 overflow-auto text-kit-sm text-kit-ink' : 'max-h-40 overflow-auto space-y-1'}>
            {filtered.map((skill) => {
              const checked = value.some((row) => row.path === skill.path)
              return (
                <label key={skill.path} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const path = String(skill.path || '')
                      onChange(event.target.checked
                        ? [...value, { name: skill.name, path }]
                        : value.filter((row) => row.path !== path))
                    }}
                  />
                  {skill.name}
                </label>
              )
            })}
            {filtered.length === 0 ? (
              <div className={kit ? 'text-kit-sm text-kit-secondary' : ''}>没有可交给 Agent 的技能。</div>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
