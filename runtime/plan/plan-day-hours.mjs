export const PLAN_DAY_HOURS = Array.from({ length: 14 }, (_, index) => 7 + index)
export const PLAN_DAY_ORIGIN_HOUR = PLAN_DAY_HOURS[0]

export function planDayOffsetMinutes(iso) {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes() - PLAN_DAY_ORIGIN_HOUR * 60
}

export function planDayMarkerTop(hour, minute) {
  return ((hour - PLAN_DAY_ORIGIN_HOUR) * 60 + minute) / 60 * 56 + 14
}
