export const PLAN_DAY_HOURS = Array.from({ length: 16 }, (_, index) => 6 + index)
export const PLAN_DAY_ORIGIN_HOUR = PLAN_DAY_HOURS[0]

export function planDayOffsetMinutes(iso) {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes() - PLAN_DAY_ORIGIN_HOUR * 60
}

export function planDayMarkerTop(hour, minute) {
  return ((hour - PLAN_DAY_ORIGIN_HOUR) * 60 + minute) / 60 * 56 + 14
}

const PLAN_DAY_END_MINUTES = 22 * 60

export function planNowMarker(date) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  if (minutes < PLAN_DAY_ORIGIN_HOUR * 60 || minutes >= PLAN_DAY_END_MINUTES) return null
  return planDayMarkerTop(date.getHours(), date.getMinutes())
}

export function scheduleInstants(date, start, end) {
  const [year, month, day] = date.split('-').map(Number)
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  return {
    start: new Date(year, month - 1, day, startHour, startMinute, 0, 0).toISOString(),
    end: new Date(year, month - 1, day, endHour, endMinute, 0, 0).toISOString(),
  }
}
