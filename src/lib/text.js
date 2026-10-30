let currentLang = 'en'

export const getLang = () => currentLang

export const setLang = (value) => {
  currentLang = value === 'zh' ? 'zh' : 'en'
}

export const l = (en, zhText) => (currentLang === 'zh' ? zhText : en)

export const t = (value) => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return currentLang === 'zh' ? value.zh || value.en || '' : value.en || value.zh || ''
}

export const caseTitle = (kase) => {
  const zhTitle = typeof kase.title === 'object' ? kase.title?.zh : kase.title
  const enTitle = kase.titleEn || (typeof kase.title === 'object' ? kase.title?.en : kase.title)
  return currentLang === 'zh' ? zhTitle || enTitle : enTitle || zhTitle
}

const THEME_ZH = {
  'Intangible heritage': '非物质文化遗产',
  'Culture & identity': '文化与身份',
  'Craft & making': '手艺与制作',
  'Elder knowledge': '代际知识',
  Environment: '环境',
  'Community voice': '社区声音',
  Education: '教育',
}

export const themeLabel = (theme) => (currentLang === 'zh' ? THEME_ZH[theme] || theme : theme)

export const searchText = (value) => {
  if (value == null) return []
  if (typeof value === 'string') return [value]
  return [value.zh, value.en].filter(Boolean)
}
