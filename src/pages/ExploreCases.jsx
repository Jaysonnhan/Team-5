import { useState } from 'react'
import { useAppState } from '../lib/AppState.jsx'
import { isTeam, visibleCases } from '../lib/visibility.js'
import { searchCases } from '../lib/search.js'
import { ALL_THEMES } from '../data/seedCases.js'
import CaseCard from '../components/CaseCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import StudentStudio from './StudentStudio.jsx'

export default function ExploreCases() {
  const { cases, role, entriesFor, remoteError } = useAppState()
  const [query, setQuery] = useState('')
  const [themes, setThemes] = useState([])
  const student = isTeam(role)

  const viewable = visibleCases(role, cases)
  const results = searchCases(viewable, { query, themes })
  const hasFilters = query.trim().length > 0 || themes.length > 0
  const hiddenCount = cases.length - viewable.length

  const toggleTheme = (theme) =>
    setThemes((prev) => (prev.includes(theme) ? prev.filter((item) => item !== theme) : [...prev, theme]))

  const themesInLibrary = ALL_THEMES.filter((theme) => viewable.some((kase) => kase.themes.includes(theme)))

  return (
    <div className="page">
      {student ? (
        <nav className="journey-stages" aria-label="Student journey">
          <a href="#explore"><span>1</span><strong>Explore</strong></a>
          <a href="#studio"><span>2</span><strong>My field study</strong></a>
        </nav>
      ) : null}

      <section className="hero" id="explore">
        <p className="eyebrow">01 / {student ? 'Explore & find ideas' : 'Student case library'}</p>
        <h1 className="page-title">
          {student ? 'Find a question. Follow your curiosity.' : 'Every journey leaves a story.'}
        </h1>
        <p className="page-lede">
          {student
            ? 'See how other students turned their curiosity into field research, then start your own journal below.'
            : 'Explore published student field studies, from their first question to what they learned along the way.'}
        </p>

        <div className="search-bar">
          <Icon name="search" size={20} className="search-icon" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a topic, place or research question"
            aria-label="Search cases"
          />
          {query ? (
            <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </div>

        <div className="theme-filters">
          <ul className="chip-row">
            {themesInLibrary.map((theme) => (
              <li key={theme}>
                <button
                  type="button"
                  className={`filter-chip ${themes.includes(theme) ? 'is-on' : ''}`}
                  aria-pressed={themes.includes(theme)}
                  onClick={() => toggleTheme(theme)}
                >
                  {theme}
                </button>
              </li>
            ))}
          </ul>
          {hasFilters ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setQuery('')
                setThemes([])
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <details className="case-overview" open>
        <summary className="case-overview-summary">
          <span>
            <span className="overview-kicker">Browse the library</span>
            <span className="overview-title">Case Overview</span>
          </span>
          <span className="overview-toggle">{results.length} {results.length === 1 ? 'case' : 'cases'} <Icon name="arrow" size={16} /></span>
        </summary>
        <div className="case-overview-body">
      <div className="results-head">
        <h2 className="results-count">
          {results.length} {results.length === 1 ? 'story' : 'stories'}
          {hasFilters ? ' found' : ' to explore'}
        </h2>
        {hiddenCount > 0 ? (
          <p className="results-note">
            <Icon name="lock" size={14} /> {hiddenCount} unpublished {hiddenCount === 1 ? 'case is' : 'cases are'} private
          </p>
        ) : null}
      </div>
      {remoteError ? <p className="studio-message is-error">Live student cases could not be loaded. The library’s existing cases are still available.</p> : null}

      {results.length > 0 ? (
        <div className="case-grid">
          {results.map((kase) => (
            <CaseCard
              key={kase.id}
              kase={kase}
              query={query}
              role={role}
              entryCount={kase.entries?.length ?? entriesFor(kase.id).length}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="search"
          title="No stories match this search"
          action={
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setQuery('')
                setThemes([])
              }}
            >
              Clear search and filters
            </button>
          }
        >
          <p>Try a broader keyword such as <em>embroidery</em>, <em>pattern</em> or <em>map</em>.</p>
        </EmptyState>
      )}
        </div>
      </details>

      {student ? <StudentStudio /> : null}
    </div>
  )
}
