import { useState } from 'react'
import { SurfaceButton } from '@/components/surface/Button'
import { resumeCoreWatch } from '@/components/settings/core-connection'
import { runtimeApi } from '@/lib/runtime-api'

export function IuiRetryButton() {
  const [failure, setFailure] = useState<Error | null>(null)
  if (failure) throw failure
  return (
    <SurfaceButton
      size="sm"
      onClick={() => {
        void runtimeApi.retryIui().then(() => {
          resumeCoreWatch()
        }, (error: unknown) => {
          setFailure(error instanceof Error ? error : new Error(String(error)))
        })
      }}
    >
      重试
    </SurfaceButton>
  )
}
