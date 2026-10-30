export const t = (value) => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value.en || value.zh || ''
}

export const zh = (value) => {
  if (!value || typeof value !== 'object') return ''
  return value.en && value.zh ? value.zh : ''
}

export const searchText = (value) => {
  if (value == null) return []
  if (typeof value === 'string') return [value]
  return [value.zh, value.en].filter(Boolean)
}
