import { useState } from 'react'
import { SurfaceButton } from '@/components/surface/Button'
import { runIuiRetry } from '@/components/settings/core-connection'

export function IuiRetryButton() {
  const [failure, setFailure] = useState<Error | null>(null)
  if (failure) throw failure
  return (
    <SurfaceButton
      size="sm"
      onClick={() => {
        void runIuiRetry().catch((error: unknown) => {
          setFailure(error instanceof Error ? error : new Error(String(error)))
        })
      }}
    >
      重试
    </SurfaceButton>
  )
}
