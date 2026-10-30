import { searchText } from './text.js'

const normalize = (value) => (value || '').toString().toLowerCase().trim()
const flatten = (values) => values.flatMap((value) => searchText(value))

export function haystack(kase) {
  const parts = [
    kase.title,
    kase.titleEn,
    ...(kase.themes || []),
    kase.summary,
    ...(kase.subjects || []),
    ...(kase.keywords || []),
    ...(kase.meta ? Object.values(kase.meta) : []),
    ...(kase.researchQuestions || []).flatMap((q) => [q.topic, q.text]),
    ...(kase.methods || []),
    ...(kase.journey || []).flatMap((step) => [step.phase, step.title, step.description]),
    ...(kase.craftSteps || []).flatMap((s) => [s.labelZh, s.labelEn, s.description]),
    ...(kase.interview
      ? kase.interview.topics.flatMap((topic) => [
          topic.name,
          ...topic.qa.flatMap((item) => [item.q, item.a]),
        ])
      : []),
    ...((kase.outcomes && kase.outcomes.conclusions) || []),
    ...(kase.impactReflection
      ? [kase.impactReflection.summary, ...(kase.impactReflection.reflections || [])]
      : []),
  ]
  return normalize(flatten(parts).join(' '))
}

export function searchCases(cases, { query = '', themes = [] }) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return cases
    .map((kase) => {
      const text = haystack(kase)
      const matched = words.every((word) => text.includes(word))
      const themeOk = themes.length === 0 || themes.some((theme) => (kase.themes || []).includes(theme))
      let score = 0
      if (matched && themeOk) {
        const title = normalize([kase.title, kase.titleEn].filter(Boolean).join(' '))
        score = words.reduce(
          (total, word) => total + (title.includes(word) ? 3 : 0) + (text.includes(word) ? 1 : 0),
          0,
        )
      }
      return { kase, score, included: matched && themeOk }
    })
    .filter((result) => result.included)
    .sort((a, b) => b.score - a.score || a.kase.title.localeCompare(b.kase.title))
    .map((result) => result.kase)
}

export function matchedFields(kase, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const groups = [
    ['title', [kase.title, kase.titleEn]],
    ['theme', kase.themes || []],
    ['keyword', [...(kase.subjects || []), ...(kase.keywords || [])]],
    ['research question', (kase.researchQuestions || []).flatMap((q) => [q.topic, q.text])],
    ['method', kase.methods || []],
    ['learning journey', (kase.journey || []).flatMap((s) => [s.phase, s.title, s.description])],
    ['craft step', (kase.craftSteps || []).flatMap((s) => [s.labelZh, s.labelEn, s.description])],
    [
      'interview',
      kase.interview
        ? kase.interview.topics.flatMap((topic) => [
            topic.name,
            ...topic.qa.flatMap((item) => [item.q, item.a]),
          ])
        : [],
    ],
    ['outcome', (kase.outcomes && kase.outcomes.conclusions) || []],
    [
      'reflection',
      kase.impactReflection
        ? [kase.impactReflection.summary, ...(kase.impactReflection.reflections || [])]
        : [],
    ],
  ]
  return groups
    .filter(([, values]) =>
      flatten(values).some((value) => words.every((word) => normalize(value).includes(word))),
    )
    .map(([label]) => label)
}

export function highlight(text, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [{ text, mark: false }]
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text
    .split(pattern)
    .filter((chunk) => chunk !== '')
    .map((chunk) => ({ text: chunk, mark: words.includes(chunk.toLowerCase()) }))
}
