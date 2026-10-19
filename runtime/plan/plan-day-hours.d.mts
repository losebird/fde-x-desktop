export const PLAN_DAY_HOURS: number[]
export const PLAN_DAY_ORIGIN_HOUR: number
export function planDayOffsetMinutes(iso: string): number
export function planDayMarkerTop(hour: number, minute: number): number
export function planNowMarker(date: Date): number | null
export function scheduleInstants(date: string, start: string, end: string): { start: string; end: string }
