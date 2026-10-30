import { Link } from 'react-router-dom'
import { StatusBadge, SourceBadge } from './badges.jsx'
import { matchedFields } from '../lib/search.js'
import { isTeam } from '../lib/visibility.js'
import { t } from '../lib/text.js'
import Icon from './Icon.jsx'

export default function CaseCard({ kase, query = '', entryCount = 0, role }) {
  const fields = matchedFields(kase, query)
  const coverImage = kase.coverImage || kase.posters?.[0]?.src
  const stats = [
    { label: 'questions', value: kase.researchQuestions?.length },
    { label: 'methods', value: kase.methods?.length },
    { label: 'journey steps', value: kase.journey?.length },
  ].filter((s) => s.value)

  return (
    <article className="case-card">
      {coverImage ? <img className="case-card-bg" src={coverImage} alt="" aria-hidden="true" loading="lazy" /> : null}
      <div className="case-card-top">
        <StatusBadge status={kase.status} />
        <SourceBadge source={kase.source} />
      </div>

      <h3 className="case-card-title">
        <Link to={`/cases/${kase.id}`}>{kase.titleEn || kase.title}</Link>
      </h3>

      <p className="case-card-summary">{t(kase.summary)}</p>

      <ul className="chip-row" aria-label="Themes">
        {kase.themes.map((theme) => (
          <li key={theme} className="chip">{theme}</li>
        ))}
      </ul>

      {fields.length > 0 ? (
        <p className="case-card-match">
          <Icon name="search" size={13} />
          Matched in {fields.slice(0, 4).join(', ')}
          {fields.length > 4 ? ` +${fields.length - 4} more` : ''}
        </p>
      ) : null}

      <footer className="case-card-foot">
        <div className="case-card-stats">
          {stats.map((s) => (
            <span key={s.label} className="stat">
              <strong>{s.value}</strong> {s.label}
            </span>
          ))}
          {isTeam(role) ? (
            <span className="stat">
              <strong>{entryCount}</strong> journal {entryCount === 1 ? 'entry' : 'entries'}
            </span>
          ) : null}
        </div>
        <Link className="link-arrow" to={`/cases/${kase.id}`}>
          Open case <Icon name="arrow" size={15} />
        </Link>
      </footer>
    </article>
  )
}
