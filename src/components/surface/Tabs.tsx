import * as Tabs from '@radix-ui/react-tabs'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { kitFocus } from '@/components/surface/classes'

export function SurfaceTabs({
  value,
  onValueChange,
  tabs,
  children,
}: {
  value: string
  onValueChange: (value: string) => void
  tabs: Array<{ id: string; label: string }>
  children: ReactNode
}) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className="inline-flex gap-0.5 rounded-kit bg-kit-sunken p-0.5">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            className={clsx(
              'rounded-[6px] px-2.5 py-1 text-kit-sm text-kit-secondary',
              'transition-[background-color,color,box-shadow] duration-kit-fast ease-kit',
              'data-[state=active]:bg-kit-card data-[state=active]:text-kit-ink data-[state=active]:shadow-kit',
              kitFocus,
            )}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <div className="mt-3">{children}</div>
    </Tabs.Root>
  )
}

export function SurfaceTabPanel({ value, children }: { value: string; children: ReactNode }) {
  return <Tabs.Content value={value}>{children}</Tabs.Content>
}
