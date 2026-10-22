/**
 * Honest miss speak: who, whose ticket, and why not now.
 * @module dsh-lan-assist/miss
 */

/**
 * @param {{
 *   name?: string,
 *   matches?: number,
 *   listen?: boolean,
 *   withdrawn?: boolean,
 *   ticket?: string,
 * }} spec
 */
export function speakMiss(spec = {}) {
  const name = String(spec.name || '对方').trim() || '对方'
  const ticket = String(spec.ticket || '').trim()
  const still = ticket ? `信撤了，${ticket}还在。撤信不等于业务作废。` : '信撤了，单还在。撤信不等于业务作废。'
  if (spec.withdrawn) return still
  if (Number(spec.matches) > 1) return `通讯录里有两个「${name}」。先点名稳定 ID，不按花名册猜。`
  if (spec.listen === false) return `${name}的听口没开，信还在路上。不装成已送到。`
  return `没配对「${name}」。花名册不能代替配对，不能按岗群发。`
}

/**
 * @param {{ staffId?: string, displayName?: string } | null | undefined} self
 */
export function speakWho(self) {
  const name = (self && self.displayName) || '这台'
  const staff = self && String(self.staffId || '').trim()
  if (!staff) return `现在这台是${name}，还没绑本机号。上午的信不能下午拿别人的登录去查。`
  return `现在是${name}的号 ${staff}。换人要重绑，不借别人的登录。`
}

export function speakExpired() {
  return '业务账号过期了，要重新登。秘书不自己重登。'
}

export function speakGuestNet(who) {
  const name = String(who || '对面').trim() || '对面'
  return `同一栋楼不够，访客网把口隔开了。还没送到${name}。不装成送到。`
}

export function speakObserve(row = {}) {
  const sends = Number(row.sends || 0)
  const lookups = Number(row.lookups || 0)
  const bits = []
  if (sends) bits.push(`送信失败 ${sends} 次`)
  if (lookups) bits.push(`查单失败 ${lookups} 次`)
  if (!bits.length) return '今天送信和查单都没报失败。'
  return `今天${bits.join('，')}。不装成已经送到或已经查过。`
}

export function speakForbidden(name) {
  const n = String(name || '这笔').trim() || '这笔'
  return `${n}这台不能碰。不在允许清单里，不能装成能调。`
}
