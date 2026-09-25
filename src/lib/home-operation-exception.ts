import type { OperationRecord } from './contracts'

/** Homepage red metric: human-actionable failures only (see home-exception-connector-plan). */
export function operationCountsAsHomeException(operation: OperationRecord): boolean {
  if (operation.state === 'failed' || operation.state === 'compensation_failed') return true
  if (operation.state === 'uncertain') return operation.executionMode !== 'dry_run'
  return false
}

export function countHomeOperationExceptions(operations: OperationRecord[]): number {
  let count = 0
  for (const row of operations) {
    if (operationCountsAsHomeException(row)) count += 1
  }
  return count
}
