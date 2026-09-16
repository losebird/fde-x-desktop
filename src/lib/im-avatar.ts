export const IM_AVATARS = [
  { id: 'leaf', emoji: '🌿', color: '#3D6B4F', label: '绿叶' },
  { id: 'fox', emoji: '🦊', color: '#C45C26', label: '狐狸' },
  { id: 'owl', emoji: '🦉', color: '#5B4B8A', label: '猫头鹰' },
  { id: 'whale', emoji: '🐳', color: '#2B6CB0', label: '鲸鱼' },
  { id: 'sun', emoji: '☀️', color: '#C9A227', label: '太阳' },
  { id: 'moon', emoji: '🌙', color: '#4A5568', label: '月亮' },
  { id: 'coffee', emoji: '☕️', color: '#6B3F2A', label: '咖啡' },
  { id: 'book', emoji: '📘', color: '#2C5282', label: '书本' },
] as const

export type ImAvatarId = (typeof IM_AVATARS)[number]['id']

export function imAvatar(id?: string | null) {
  return IM_AVATARS.find((item) => item.id === id) ?? IM_AVATARS[0]
}
