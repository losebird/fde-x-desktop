type Props = {
  serverName: string
  tools: string[]
  describe?: string
  list?: string
  write?: string
  onChange: (slot: 'describe' | 'list' | 'write', tool: string) => void
}

function SlotSelect({
  label,
  value,
  optional,
  tools,
  onChange,
}: {
  label: string
  value?: string
  optional?: boolean
  tools: string[]
  onChange: (tool: string) => void
}) {
  const listed = value && !tools.includes(value) ? [value, ...tools] : tools
  return (
    <label className="text-xs text-ink-muted">
      {label}
      <select className="input mt-1" value={value || ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">{optional ? '不绑（不能写）' : '选择工具'}</option>
        {listed.map((tool) => (
          <option key={tool} value={tool}>{tool}</option>
        ))}
      </select>
    </label>
  )
}

export function BizHandleSlots({ serverName, tools, describe, list, write, onChange }: Props) {
  void serverName
  return (
    <div className="grid grid-cols-1 gap-2">
      <SlotSelect label="describe（词表）" value={describe} tools={tools} onChange={(tool) => onChange('describe', tool)} />
      <SlotSelect label="list（现查）" value={list} tools={tools} onChange={(tool) => onChange('list', tool)} />
      <SlotSelect label="write（过账）" value={write} optional tools={tools} onChange={(tool) => onChange('write', tool)} />
    </div>
  )
}
