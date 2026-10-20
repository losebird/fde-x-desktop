export function recordsLandConnectionId({
  currentId,
  dataLand,
  connectionLand,
  landConnection,
  connections,
  vocabConnection,
}) {
  const wanted = String(landConnection || '').trim()
  const named = Number(connectionLand) === Number(dataLand) && wanted
    ? (Array.isArray(connections) ? connections : []).find((item) => item && (item.name === wanted || item.id === wanted))
    : null
  if (named) return String(currentId || '')
  const conn = String(vocabConnection || '').trim()
  if (conn && conn !== 'lookup') return conn
  return String(currentId || '')
}
