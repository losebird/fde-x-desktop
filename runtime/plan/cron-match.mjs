function parseList(field, min, max) {
  const parts = String(field || '').trim().split(',')
  const allowed = new Set()
  for (const part of parts) {
    const token = part.trim()
    if (!token) return null
    const stepSplit = token.split('/')
    const range = stepSplit[0]
    const step = stepSplit.length > 1 ? Number(stepSplit[1]) : 1
    if (!Number.isInteger(step) || step <= 0) return null
    let start
    let end
    if (range === '*') {
      start = min
      end = max
    } else if (range.includes('-')) {
      const [left, right] = range.split('-')
      start = Number(left)
      end = Number(right)
    } else {
      start = Number(range)
      end = start
    }
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null
    if (start < min || end > max || start > end) return null
    for (let value = start; value <= end; value += step) allowed.add(value)
  }
  return allowed
}

export function cronFieldMatches(field, value, min, max) {
  const allowed = parseList(field, min, max)
  if (!allowed) return false
  return allowed.has(value)
}

export function parseCronExpr(expr) {
  const fields = String(expr || '').trim().split(/\s+/)
  if (fields.length !== 5) return null
  return {
    minute: fields[0],
    hour: fields[1],
    day: fields[2],
    month: fields[3],
    weekday: fields[4],
  }
}

export function civilClock(instant, timeZone) {
  const zone = timeZone && String(timeZone).trim() ? String(timeZone).trim() : 'Asia/Shanghai'
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const bag = {}
  for (const part of fmt.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') bag[part.type] = part.value
  }
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  let hour = Number(bag.hour)
  let year = Number(bag.year)
  let month = Number(bag.month)
  let day = Number(bag.day)
  if (hour === 24) {
    hour = 0
    const next = new Date(Date.UTC(year, month - 1, day) + 24 * 60 * 60 * 1000)
    year = next.getUTCFullYear()
    month = next.getUTCMonth() + 1
    day = next.getUTCDate()
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(bag.minute),
    weekday: weekdayMap[bag.weekday] ?? 0,
  }
}

export function cronMatches(expr, clock) {
  const parsed = parseCronExpr(expr)
  if (!parsed) return false
  const weekday = clock.weekday === 7 ? 0 : clock.weekday
  const weekdayOk = cronFieldMatches(parsed.weekday, weekday, 0, 7)
    || (weekday === 0 && cronFieldMatches(parsed.weekday, 7, 0, 7))
  return cronFieldMatches(parsed.minute, clock.minute, 0, 59)
    && cronFieldMatches(parsed.hour, clock.hour, 0, 23)
    && cronFieldMatches(parsed.day, clock.day, 1, 31)
    && cronFieldMatches(parsed.month, clock.month, 1, 12)
    && weekdayOk
}

export function cronOccurrences(expr, timeZone, fromMs, toMs) {
  const parsed = parseCronExpr(expr)
  if (!parsed) return []
  const start = Math.floor(Number(fromMs) / 60_000) * 60_000
  const end = Math.floor(Number(toMs) / 60_000) * 60_000
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  const hits = []
  for (let ts = start; ts <= end; ts += 60_000) {
    if (cronMatches(expr, civilClock(ts, timeZone))) hits.push(new Date(ts).toISOString())
  }
  return hits
}
