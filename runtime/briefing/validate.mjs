import { RENDER_TYPES, SECTION_TYPES } from './defaults.mjs'

/**
 * @param {unknown} sections
 * @returns {string[]}
 */
export function validateSections(sections) {
  const errors = []
  if (!Array.isArray(sections)) {
    errors.push('sections 必须是数组')
    return errors
  }
  const ids = new Set()
  for (const [index, row] of sections.entries()) {
    const prefix = `sections[${index}]`
    if (!row || typeof row !== 'object') {
      errors.push(`${prefix} 必须是对象`)
      continue
    }
    const id = typeof row.id === 'string' ? row.id.trim() : ''
    if (!id) errors.push(`${prefix}.id 不能为空`)
    else if (ids.has(id)) errors.push(`${prefix}.id 重复：${id}`)
    else ids.add(id)
    const type = typeof row.type === 'string' ? row.type.trim() : ''
    if (!SECTION_TYPES.has(type)) errors.push(`${prefix}.type 不在允许集合内`)
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) errors.push(`${prefix}.title 不能为空`)
    const render = typeof row.render === 'string' ? row.render.trim() : ''
    if (!RENDER_TYPES.has(render)) errors.push(`${prefix}.render 不在允许集合内`)
    if (row.enabled !== undefined && typeof row.enabled !== 'boolean') {
      errors.push(`${prefix}.enabled 必须是布尔值`)
    }
    if (row.params !== undefined && (typeof row.params !== 'object' || row.params === null || Array.isArray(row.params))) {
      errors.push(`${prefix}.params 必须是对象`)
    }
  }
  return errors
}

/**
 * @param {unknown} schedule
 * @returns {string[]}
 */
export function validateSchedule(schedule) {
  const errors = []
  if (schedule === null || schedule === undefined) return errors
  if (typeof schedule !== 'object' || Array.isArray(schedule)) {
    errors.push('schedule 必须是对象')
    return errors
  }
  const at = typeof schedule.at === 'string' ? schedule.at.trim() : ''
  if (at && !/^\d{2}:\d{2}$/u.test(at)) errors.push('schedule.at 格式应为 HH:MM')
  if (schedule.days !== undefined) {
    if (!Array.isArray(schedule.days) || schedule.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      errors.push('schedule.days 应为 0–6 的整数数组')
    }
  }
  if (schedule.onOpen !== undefined && typeof schedule.onOpen !== 'boolean') {
    errors.push('schedule.onOpen 必须是布尔值')
  }
  if (schedule.tz !== undefined && typeof schedule.tz !== 'string') {
    errors.push('schedule.tz 必须是字符串')
  }
  return errors
}

/**
 * @param {unknown} sources
 * @returns {string[]}
 */
export function validateSources(sources) {
  const errors = []
  if (sources === undefined) return errors
  if (!Array.isArray(sources)) {
    errors.push('sources 必须是数组')
    return errors
  }
  for (const [index, row] of sources.entries()) {
    if (!row || typeof row !== 'object') {
      errors.push(`sources[${index}] 必须是对象`)
      continue
    }
    const type = typeof row.type === 'string' ? row.type.trim() : ''
    if (!type) errors.push(`sources[${index}].type 不能为空`)
  }
  return errors
}
