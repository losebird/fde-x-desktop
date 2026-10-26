const SHORTCUTS = [
  ['全局搜索', '⌘ K'],
  ['新会话', '⌘ N'],
  ['新建任务', '⌘ T'],
  ['新建事件', '⌘ E'],
  ['打开早报', '⌘ 0'],
  ['切换 IM 静音', '⌘ ;'],
  ['上一会话', '⌘ ↑'],
  ['下一会话', '⌘ ↓'],
] as const

export function ShortcutsSection() {
  return (
    <section className="rounded-kit-lg border border-kit-line bg-kit-card p-4 shadow-kit">
      <h3 className="text-kit-title font-medium text-kit-ink">快捷键</h3>
      <p className="mb-3 mt-1 text-kit-sm text-kit-secondary">这些是工作台里已经接上的按键。这一页不能改键位。</p>
      <table className="w-full text-kit">
        <tbody>
          {SHORTCUTS.map(([label, keys]) => (
            <tr key={label} className="border-t border-kit-line first:border-t-0">
              <td className="py-2 text-kit-ink">{label}</td>
              <td className="py-2 text-right">
                {keys.split(' ').map((key) => <span key={key} className="kbd ml-1">{key}</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
