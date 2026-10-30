import { Link } from 'react-router-dom'
import { StatusBadge, SourceBadge } from './badges.jsx'
import { caseTitle, themeLabel } from '../lib/text.js'

export default function CaseCard({ kase }) {
  const coverImage = kase.coverImage || kase.posters?.[0]?.src

  return (
    <article className="case-card">
      {coverImage ? <img className="case-card-bg" src={coverImage} alt="" aria-hidden="true" loading="lazy" /> : null}
      <div className="case-card-top">
        <StatusBadge status={kase.status} />
        <SourceBadge source={kase.source} />
      </div>

      <h3 className="case-card-title">
        <Link to={`/cases/${kase.id}`}>{caseTitle(kase)}</Link>
      </h3>

      <ul className="chip-row" aria-label="Themes">
        {kase.themes.map((theme) => (
          <li key={theme} className="chip">{themeLabel(theme)}</li>
        ))}
      </ul>
    </article>
  )
}
