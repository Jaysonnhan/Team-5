import { createContext, useContext, useEffect, useState } from 'react'
import { getLang, setLang as setGlobalLang } from './text.js'

const STORAGE_KEY = 'dream-journey-lang'
const LanguageContext = createContext(null)

function initialLang() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang)
  setGlobalLang(lang)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.title =
      lang === 'zh'
        ? '去远方 · 学生案例库与研学日志'
        : 'Dream Journey — Case Library & Learning Journal'
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const value = {
    lang,
    setLang,
    toggle: () => setLang((current) => (current === 'zh' ? 'en' : 'zh')),
  }
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLang must be used inside LanguageProvider')
  return value
}

export { getLang }
