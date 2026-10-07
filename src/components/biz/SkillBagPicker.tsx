import { useState } from 'react'
import type { FdeAppSkillBind } from '@/lib/app-spec'
import type { SkillBagItem } from '@/lib/runtime-api'

type Props = {
  skills: SkillBagItem[]
  value: FdeAppSkillBind[]
  onChange: (next: FdeAppSkillBind[]) => void
  label?: string
}

export function SkillBagPicker({ skills, value, onChange, label }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const bag = skills.filter((row) => row.path && row.path.startsWith('/'))
  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? bag.filter((row) => row.name.toLowerCase().includes(needle) || String(row.path || '').toLowerCase().includes(needle))
    : bag

  return (
    <div className="space-y-1 text-xs text-ink-muted">
      <button type="button" className="btn h-7 px-2 text-xs" onClick={() => setOpen((current) => !current)}>
        {open ? '收起 Skills' : (label || '交给 Agent 的 Skills')}
        {value.length ? ` · ${value.length}` : ''}
      </button>
      {open && (
        <>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="过滤名称"
          />
          <div className="max-h-40 overflow-auto space-y-1">
            {filtered.map((skill) => {
              const checked = value.some((row) => row.path === skill.path)
              return (
                <label key={skill.path} className="flex items-center gap-2 cursor-pointer">
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
          </div>
        </>
      )}
    </div>
  )
}
