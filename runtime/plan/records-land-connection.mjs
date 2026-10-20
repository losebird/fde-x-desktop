export function recordsLandConnectionId({
  currentId,
  dataLand,
  connectionLand,
  landConnection,
  connections,
}) {
  const wanted = String(landConnection || '').trim()
  const named = Number(connectionLand) === Number(dataLand) && wanted
    ? (Array.isArray(connections) ? connections : []).find((item) => item && (item.name === wanted || item.id === wanted))
    : null
  if (named) return named.id
  return String(currentId || '')
}
