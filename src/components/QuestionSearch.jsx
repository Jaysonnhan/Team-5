import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'
import { searchText, t } from '../lib/text.js'

const normalize = (value) => value.toLowerCase().trim()

export default function QuestionSearch({ cases, currentCaseId, onUseQuestion }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const questions = useMemo(
    () =>
      cases
        .filter((kase) => kase.id !== currentCaseId)
        .flatMap((kase) =>
          (kase.researchQuestions || []).map((question, index) => ({
            ...question,
            id: `${kase.id}-${index}`,
            caseId: kase.id,
            caseTitle: kase.titleEn || kase.title,
            sourceKind: kase.source.kind,
            keywords: kase.keywords || [],
          })),
        ),
    [cases, currentCaseId],
  )

  const categories = useMemo(
    () => [...new Set(questions.map((question) => t(question.topic)).filter(Boolean))].sort(),
    [questions],
  )

  const words = normalize(query).split(/\s+/).filter(Boolean)
  const matches = questions.filter((question) => {
    const categoryMatch = !category || t(question.topic) === category
    const searchable = [
      ...searchText(question.text),
      ...searchText(question.topic),
      question.caseTitle,
      ...question.keywords,
    ].join(' ').toLowerCase()
    return categoryMatch && words.every((word) => searchable.includes(word))
  })
  const shown = query || category ? matches : questions.slice(0, 3)

  return (
    <section className="question-finder" aria-labelledby="question-finder-title">
      <div className="question-finder-head">
        <div>
          <p className="eyebrow">Need a starting point?</p>
          <h3 id="question-finder-title">Find a similar past question</h3>
        </div>
        <Icon name="question" size={22} />
      </div>
      <p className="question-finder-intro">
        Search question keywords or browse categories from other cases. Adapt an idea to your own project rather than starting from a blank page.
      </p>
      <label className="question-search-box">
        <Icon name="search" size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “technology”, “feeling”, “method”…"
          aria-label="Search past research questions"
        />
        {query ? (
          <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Clear question search">
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </label>
      <div className="question-categories" aria-label="Question categories">
        <button
          type="button"
          className={`filter-chip ${!category ? 'is-on' : ''}`}
          aria-pressed={!category}
          onClick={() => setCategory('')}
        >
          All categories
        </button>
        {categories.map((item) => (
          <button
            type="button"
            key={item}
            className={`filter-chip ${category === item ? 'is-on' : ''}`}
            aria-pressed={category === item}
            onClick={() => setCategory(category === item ? '' : item)}
          >
            {item}
          </button>
        ))}
      </div>
      <p className="question-results-count" aria-live="polite">
        {query || category ? `${matches.length} matching ${matches.length === 1 ? 'question' : 'questions'}` : 'Example questions from the library'}
      </p>
      {shown.length ? (
        <ul className="question-results">
          {shown.map((question) => (
            <li key={question.id} className="question-result">
              <div className="question-result-meta">
                <span className="q-topic">{t(question.topic)}</span>
                {question.sourceKind === 'fictional_demo' ? <span className="demo-label">Fictional demo</span> : null}
              </div>
              <p className="question-result-text">{t(question.text)}</p>
              <div className="question-result-foot">
                <Link to={`/cases/${question.caseId}`}>{question.caseTitle} <Icon name="arrow" size={13} /></Link>
                <button type="button" className="text-btn" onClick={() => onUseQuestion(t(question.text))}>
                  Use as a starting point
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="question-no-results">
          <p>No past questions match. Try one keyword or choose another category.</p>
          <button type="button" className="text-btn" onClick={() => { setQuery(''); setCategory('') }}>
            Clear question search
          </button>
        </div>
      )}
    </section>
  )
}
