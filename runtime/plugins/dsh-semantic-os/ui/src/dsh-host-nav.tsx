export type HostAction = { id: string; label: string; onClick: () => void };
export function HostNav({ actions }: { actions?: HostAction[] }) {
  if (!actions?.length) return null;
  return (
    <>
      {actions.map((a) => (
        <button key={a.id} type="button" className="dsh-mode-btn" onClick={a.onClick}>{a.label}</button>
      ))}
    </>
  );
}
