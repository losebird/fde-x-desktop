/** Finish an in-process handshake: receiver clicks 确定, initiator gets the ack. */

export async function afterHandshake(from, into, hs) {
  if (!hs || hs.ok === false) return hs
  const accepted = await into.acceptPairAsk()
  if (!accepted || accepted.ok === false) return accepted
  return { ok: true, ...(await from.snapshot()) }
}
