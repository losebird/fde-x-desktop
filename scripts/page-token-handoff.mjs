export function readUiTokenLine(line) {
  const match = /^FDE_UI_TOKEN\s+([0-9a-f]{64})$/u.exec(String(line || '').trim())
  return match ? match[1] : ''
}

export function bindPageToken(viteChild, getToken) {
  const send = () => {
    const token = getToken()
    if (!token || !viteChild.connected) return
    viteChild.send({ type: 'fde-ui-token', token })
  }
  viteChild.on('message', (msg) => {
    if (msg && msg.type === 'fde-vite-listening') send()
  })
  return send
}
