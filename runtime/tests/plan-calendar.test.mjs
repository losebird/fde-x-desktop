import './support/no-stray-processes.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  planDateKey,
  planDayLabel,
  planJumpByView,
  planMonthGrid,
  planMonthLabel,
  planSameDay,
  planShiftByView,
  planShiftDay,
  planShiftMonth,
  planShiftWeek,
  planShiftYear,
  planStartOfWeekMonday,
  planViewLabel,
  planWeekDays,
  planWeekLabel,
} from '../plan/plan-calendar.mjs'

test('周从周一起，含光标日', () => {
  const sunday = new Date(2026, 10, 15)
  const start = planStartOfWeekMonday(sunday)
  assert.equal(planDateKey(start), '2026-11-09')
  const days = planWeekDays(sunday)
  assert.equal(days.length, 7)
  assert.equal(planDateKey(days[0]), '2026-11-09')
  assert.equal(planDateKey(days[6]), '2026-11-15')
})

test('翻月保住日，月末夹到当月最后一天', () => {
  const jan31 = new Date(2026, 0, 31)
  const feb = planShiftMonth(jan31, 1)
  assert.equal(planDateKey(feb), '2026-02-28')
  const march = planShiftMonth(feb, 1)
  assert.equal(planDateKey(march), '2026-03-28')
  const dec = planShiftMonth(new Date(2026, 10, 11), 1)
  assert.equal(planDateKey(dec), '2026-12-11')
  const prevYear = planShiftMonth(new Date(2026, 0, 11), -1)
  assert.equal(planDateKey(prevYear), '2025-12-11')
})

test('翻年保住月日', () => {
  const cursor = new Date(2026, 10, 11)
  assert.equal(planDateKey(planShiftYear(cursor, 1)), '2027-11-11')
  assert.equal(planDateKey(planShiftYear(cursor, -1)), '2025-11-11')
  const leap = planShiftYear(new Date(2024, 1, 29), 1)
  assert.equal(planDateKey(leap), '2025-02-28')
})

test('月格子 6 行周一开头，含邻月', () => {
  const cells = planMonthGrid(new Date(2026, 10, 11))
  assert.equal(cells.length, 42)
  assert.equal(cells[0].key, '2026-10-26')
  assert.equal(cells[0].inMonth, false)
  assert.equal(cells[6].key, '2026-11-01')
  assert.equal(cells[6].inMonth, true)
  const cursor = cells.find((cell) => cell.key === '2026-11-11')
  assert.equal(cursor?.inMonth, true)
  const lastNov = cells.find((cell) => cell.key === '2026-11-30')
  assert.equal(lastNov?.inMonth, true)
  const dec1 = cells.find((cell) => cell.key === '2026-12-01')
  assert.equal(dec1?.inMonth, false)
  assert.equal(planMonthLabel(new Date(2026, 10, 1)), '2026年11月')
  assert.equal(planSameDay(new Date(2026, 10, 11, 17, 0), new Date(2026, 10, 11, 9, 0)), true)
})

test('翻天跨月跨年', () => {
  assert.equal(planDateKey(planShiftDay(new Date(2026, 10, 12), 1)), '2026-11-13')
  assert.equal(planDateKey(planShiftDay(new Date(2026, 10, 12), -1)), '2026-11-11')
  assert.equal(planDateKey(planShiftDay(new Date(2026, 10, 30), 1)), '2026-12-01')
  assert.equal(planDateKey(planShiftDay(new Date(2026, 11, 31), 1)), '2027-01-01')
})

test('翻周整周平移', () => {
  const week = planWeekDays(planShiftWeek(new Date(2026, 10, 12), 1))
  assert.equal(planDateKey(week[0]), '2026-11-16')
  assert.equal(planDateKey(week[6]), '2026-11-22')
  const prev = planWeekDays(planShiftWeek(new Date(2026, 10, 12), -1))
  assert.equal(planDateKey(prev[0]), '2026-11-02')
  assert.equal(planDateKey(prev[6]), '2026-11-08')
})

test('日周月步进和跳步跟当前视图走', () => {
  const cursor = new Date(2026, 10, 12)
  assert.equal(planDateKey(planShiftByView(cursor, 'day', 1)), '2026-11-13')
  assert.equal(planDateKey(planShiftByView(cursor, 'week', 1)), '2026-11-19')
  assert.equal(planDateKey(planShiftByView(cursor, 'month', 1)), '2026-12-12')
  assert.equal(planDateKey(planJumpByView(cursor, 'day', 1)), '2026-11-19')
  assert.equal(planDateKey(planJumpByView(cursor, 'week', 1)), '2026-12-12')
  assert.equal(planDateKey(planJumpByView(cursor, 'month', 1)), '2027-11-12')
})

test('日周标签写出当前范围', () => {
  assert.equal(planDayLabel(new Date(2026, 10, 12)), '2026年11月12日')
  assert.equal(planWeekLabel(new Date(2026, 10, 12)), '2026年11月9日–15日')
  assert.equal(planWeekLabel(new Date(2026, 10, 30)), '2026年11月30日–12月6日')
  assert.equal(planWeekLabel(new Date(2026, 11, 28)), '2026年12月28日–2027年1月3日')
  assert.equal(planViewLabel(new Date(2026, 10, 12), 'day'), '2026年11月12日')
  assert.equal(planViewLabel(new Date(2026, 10, 12), 'week'), '2026年11月9日–15日')
  assert.equal(planViewLabel(new Date(2026, 10, 12), 'month'), '2026年11月')
})

test('计划日程页接日周月翻页', () => {
  const source = readFileSync(new URL('../../src/pages/Plan.tsx', import.meta.url), 'utf8')
  assert.equal(source.includes("view === 'month'"), true)
  assert.equal(source.includes('data-plan-cal-view'), true)
  assert.equal(source.includes('data-plan-cal-step-prev'), true)
  assert.equal(source.includes('data-plan-cal-step-next'), true)
  assert.equal(source.includes('data-plan-cal-jump-prev'), true)
  assert.equal(source.includes('data-plan-cal-jump-next'), true)
  assert.equal(source.includes('planShiftByView'), true)
  assert.equal(source.includes('planJumpByView'), true)
  assert.equal(source.includes('planViewLabel'), true)
  assert.equal(source.includes('planMonthGrid'), true)
})
