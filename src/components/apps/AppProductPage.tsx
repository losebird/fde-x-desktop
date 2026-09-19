import { useState } from 'react'
import clsx from 'clsx'
import { AppCapabilityBar } from '@/components/apps/AppCapabilityBar'
import { SpecCards } from '@/components/apps/SpecCards'
import { SpecChart } from '@/components/apps/SpecChart'
import { SpecFeed } from '@/components/apps/SpecFeed'
import { SpecForm } from '@/components/apps/SpecForm'
import { SpecKanban } from '@/components/apps/SpecKanban'
import { SpecStat } from '@/components/apps/SpecStat'
import { SpecTable } from '@/components/apps/SpecTable'
import {
  mockRowsForEntity,
  viewById,
  type FdeAppDetail,
  type FdeAppPage,
  type FdeAppView,
} from '@/lib/app-spec'

type Props = {
  app: FdeAppDetail
  workspaceCwd: string
  onRefresh: () => void
}

export function AppProductPage({ app, workspaceCwd, onRefresh }: Props) {
  const pages = app.spec.pages ?? []
  const [pageId, setPageId] = useState(pages[0]?.id || '')
  const [reloadToken, setReloadToken] = useState(0)
  const page = pages.find((row) => row.id === pageId) || pages[0]
  const preview = app.status !== 'active'

  const refresh = () => {
    setReloadToken((value) => value + 1)
    onRefresh()
  }

  if (!page) return null

  return (
    <div className="space-y-4" data-app-product="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {pages.length > 1 ? (
          <div className="flex items-center gap-1" data-app-product-nav="true">
            {pages.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setPageId(row.id)}
                className={clsx(
                  'h-8 px-3 rounded text-sm',
                  row.id === page.id ? 'bg-ink text-white' : 'text-ink-muted hover:bg-surface-2',
                )}
              >
                {row.label || row.id}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm font-medium" data-app-product-nav="true">{page.label || app.spec.name}</div>
        )}
        <AppCapabilityBar spec={app.spec} />
      </div>
      {page.blocks.map((block, index) => (
        <ProductBlock
          key={`${page.id}-${block.kind}-${index}`}
          app={app}
          workspaceCwd={workspaceCwd}
          preview={preview}
          reloadToken={reloadToken}
          onRefresh={refresh}
          view={block.kind === 'stats' ? undefined : viewById(app.spec, block.view)}
          statViews={block.kind === 'stats' ? block.views.map((id) => viewById(app.spec, id)).filter((row): row is FdeAppView => Boolean(row)) : []}
          kind={block.kind}
        />
      ))}
    </div>
  )
}

function ProductBlock({
  app, workspaceCwd, preview, reloadToken, onRefresh, view, statViews, kind,
}: {
  app: FdeAppDetail
  workspaceCwd: string
  preview: boolean
  reloadToken: number
  onRefresh: () => void
  view?: FdeAppView
  statViews: FdeAppView[]
  kind: FdeAppPage['blocks'][number]['kind']
}) {
  if (kind === 'stats') {
    return (
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-3" data-app-overview="true">
        {statViews.map((stat) => (
          <SpecStat
            key={stat.id || stat.label}
            app={app}
            view={stat}
            workspaceCwd={workspaceCwd}
            previewRows={preview ? mockRowsForEntity(app.spec, stat.entity) : undefined}
            variant="tile"
          />
        ))}
      </div>
    )
  }
  if (!view) return null
  const previewRows = preview ? mockRowsForEntity(app.spec, view.entity) : undefined
  if (kind === 'compose' || kind === 'form') {
    return (
      <div className="border border-line rounded-lg p-3 space-y-2">
        <div className="text-sm font-medium">{view.label || '记下'}</div>
        <SpecForm
          app={app}
          entity={view.entity}
          workspaceCwd={workspaceCwd}
          readOnly={app.status !== 'active'}
          layout="compose"
          submitLabel={view.label}
          onDone={onRefresh}
        />
      </div>
    )
  }
  if (kind === 'chart') {
    return <SpecChart app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} reloadToken={reloadToken} />
  }
  if (kind === 'feed') {
    return <SpecFeed app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} reloadToken={reloadToken} />
  }
  if (kind === 'cards') {
    return <SpecCards app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} reloadToken={reloadToken} />
  }
  if (kind === 'kanban') {
    return <SpecKanban app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} />
  }
  if (kind === 'table') {
    return (
      <SpecTable
        app={app}
        view={view}
        workspaceCwd={workspaceCwd}
        previewRows={previewRows}
        onRefresh={onRefresh}
      />
    )
  }
  return null
}
