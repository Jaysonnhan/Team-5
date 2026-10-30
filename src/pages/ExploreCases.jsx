import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../lib/AppState.jsx'
import { useLang } from '../lib/i18n.jsx'
import { isTeam, visibleCases } from '../lib/visibility.js'
import { searchCases } from '../lib/search.js'
import { ALL_THEMES } from '../data/seedCases.js'
import CaseCard from '../components/CaseCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { l, themeLabel } from '../lib/text.js'

export default function ExploreCases() {
  useLang()
  const { cases, role, remoteError } = useAppState()
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
        <nav className="journey-stages" aria-label={l('Student journey', '学生研究路径')}>
          <a href="#explore" className="is-current" aria-current="page"><span>1</span><strong>{l('Explore', '探索')}</strong></a>
          <Link to="/studio"><span>2</span><strong>{l('My field study', '我的田野研究')}</strong></Link>
        </nav>
      ) : null}

      <section className="hero" id="explore">
        <p className="eyebrow">01 / {student ? l('Explore & find ideas', '探索与寻找灵感') : l('Student case library', '学生案例库')}</p>
        <h1 className="page-title">
          {student
            ? l('Find a question. Follow your curiosity.', '先找到一个好问题，然后跟随好奇心。')
            : l('Every journey leaves a story.', '每段旅程，都会留下一个故事。')}
        </h1>
        <p className="page-lede">
          {student
            ? l(
                'See how other students turned their curiosity into field research, then start your own journal below.',
                '看看其他同学如何把好奇心变成田野研究，然后在下方开始你自己的日志。',
              )
            : l(
                'Explore published student field studies, from their first question to what they learned along the way.',
                '浏览已发布的学生田野研究，从最初的问题到一路上的收获。',
              )}
        </p>

        <div className="search-bar">
          <Icon name="search" size={20} className="search-icon" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={l('Search a topic, place or research question', '搜索主题、地点或研究问题')}
            aria-label={l('Search cases', '搜索案例')}
          />
          {query ? (
            <button type="button" className="icon-btn" onClick={() => setQuery('')} aria-label={l('Clear search', '清除搜索')}>
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
                  {themeLabel(theme)}
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
              {l('Clear filters', '清除筛选')}
            </button>
          ) : null}
        </div>
      </section>

      <details className="case-overview" open>
        <summary className="case-overview-summary">
          <span>
            <span className="overview-kicker">{l('Browse the library', '浏览案例库')}</span>
            <span className="overview-title">{l('Case Overview', '案例总览')}</span>
          </span>
          <span className="overview-toggle">
            {l(`${results.length} ${results.length === 1 ? 'case' : 'cases'}`, `${results.length} 个案例`)} <Icon name="arrow" size={16} />
          </span>
        </summary>
        <div className="case-overview-body">
          <div className="results-head">
            <h2 className="results-count">
              {hasFilters
                ? l(`${results.length} ${results.length === 1 ? 'story' : 'stories'} found`, `找到 ${results.length} 个故事`)
                : l(`${results.length} ${results.length === 1 ? 'story' : 'stories'} to explore`, `有 ${results.length} 个故事可探索`)}
            </h2>
            {hiddenCount > 0 ? (
              <p className="results-note">
                <Icon name="lock" size={14} />{' '}
                {l(
                  `${hiddenCount} unpublished ${hiddenCount === 1 ? 'case is' : 'cases are'} private`,
                  `${hiddenCount} 个未发布案例仅自己可见`,
                )}
              </p>
            ) : null}
          </div>
          {remoteError ? (
            <p className="studio-message is-error">
              {l('Live student cases could not be loaded. The library’s existing cases are still available.', '在线学生案例加载失败，案例库中已有的案例仍可浏览。')}
            </p>
          ) : null}

          {results.length > 0 ? (
            <div className="case-grid">
              {results.map((kase) => (
                <CaseCard key={kase.id} kase={kase} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="search"
              title={l('No stories match this search', '没有找到匹配的故事')}
              action={
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setThemes([])
                  }}
                >
                  {l('Clear search and filters', '清除搜索与筛选')}
                </button>
              }
            >
              <p>
                {l('Try a broader keyword such as ', '试试更宽泛的关键词，例如 ')}
                <em>{l('embroidery', '刺绣')}</em>
                {l(', ', '、')}
                <em>{l('pattern', '纹样')}</em>
                {l(' or ', ' 或 ')}
                <em>{l('map', '地图')}</em>.
              </p>
            </EmptyState>
          )}
        </div>
      </details>
    </div>
  )
}
