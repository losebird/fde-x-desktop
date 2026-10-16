import { classifySurfaceFailure } from '@/components/surface/phase'

export function surfaceNote(cause: unknown, fallback: string) {
  return classifySurfaceFailure(cause, fallback).message
}
