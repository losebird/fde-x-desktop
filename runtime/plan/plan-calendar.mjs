export function planStartOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function planDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function planSameDay(left, right) {
  return planDateKey(left) === planDateKey(right)
}

export function planStartOfWeekMonday(date) {
  const next = planStartOfDay(date)
  const weekday = next.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  next.setDate(next.getDate() + mondayOffset)
  return next
}

export function planWeekDays(date) {
  const start = planStartOfWeekMonday(date)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

export function planShiftDay(date, delta) {
  const next = planStartOfDay(date)
  next.setDate(next.getDate() + Number(delta) || 0)
  return next
}

export function planShiftWeek(date, delta) {
  return planShiftDay(date, (Number(delta) || 0) * 7)
}

export function planShiftMonth(date, delta) {
  const cursor = planStartOfDay(date)
  const day = cursor.getDate()
  cursor.setDate(1)
  cursor.setMonth(cursor.getMonth() + delta)
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  cursor.setDate(Math.min(day, last))
  return cursor
}

export function planShiftYear(date, delta) {
  return planShiftMonth(date, delta * 12)
}

export function planShiftByView(date, view, direction) {
  const dir = direction < 0 ? -1 : 1
  if (view === 'day') return planShiftDay(date, dir)
  if (view === 'week') return planShiftWeek(date, dir)
  return planShiftMonth(date, dir)
}

export function planJumpByView(date, view, direction) {
  const dir = direction < 0 ? -1 : 1
  if (view === 'day') return planShiftWeek(date, dir)
  if (view === 'week') return planShiftMonth(date, dir)
  return planShiftYear(date, dir)
}

export function planDayLabel(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function planWeekLabel(date) {
  const days = planWeekDays(date)
  const start = days[0]
  const end = days[6]
  if (start.getFullYear() !== end.getFullYear()) {
    return `${planDayLabel(start)}–${planDayLabel(end)}`
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${planDayLabel(start)}–${end.getMonth() + 1}月${end.getDate()}日`
  }
  return `${planDayLabel(start)}–${end.getDate()}日`
}

export function planViewLabel(date, view) {
  if (view === 'day') return planDayLabel(date)
  if (view === 'week') return planWeekLabel(date)
  return planMonthLabel(date)
}

export function planMonthLabel(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function planMonthGrid(date) {
  const cursor = planStartOfDay(date)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const start = planStartOfWeekMonday(new Date(year, month, 1))
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return {
      date: day,
      key: planDateKey(day),
      inMonth: day.getMonth() === month,
    }
  })
}
