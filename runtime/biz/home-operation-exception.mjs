/** Homepage red metric: human-actionable failures only (see home-exception-connector-plan). */

export function operationCountsAsHomeException(operation) {
  if (!operation || typeof operation !== 'object') return false
  const state = String(operation.state || '')
  if (state === 'failed' || state === 'compensation_failed') return true
  if (state === 'uncertain') {
    return String(operation.executionMode || '') !== 'dry_run'
  }
  return false
}

export function countHomeOperationExceptions(operations) {
  let count = 0
  for (const row of Array.isArray(operations) ? operations : []) {
    if (operationCountsAsHomeException(row)) count += 1
  }
  return count
}
