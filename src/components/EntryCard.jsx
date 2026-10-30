import { ENTRY_KINDS, isTeam, kindLabel } from '../lib/visibility.js'
import { formatDateTime } from '../lib/format.js'
import { l } from '../lib/text.js'
import Icon from './Icon.jsx'

export default function EntryCard({ entry, onToggleVisibility, onDelete, role }) {
  const kind = ENTRY_KINDS[entry.kind] || ENTRY_KINDS.note
  const teamOnly = entry.visibility === 'team'

  return (
    <li className={`entry entry-${kind.accent} ${teamOnly ? 'is-team' : ''}`}>
      <span className="entry-rail-dot" aria-hidden="true" />
      <div className="entry-body">
        <div className="entry-head">
          <span className="entry-kind">{kindLabel(entry.kind)}</span>
          <span className={`vis-tag ${teamOnly ? 'vis-team' : 'vis-public'}`}>
            <Icon name={teamOnly ? 'lock' : 'eye'} size={12} />
            {teamOnly ? l('Team only', '仅团队') : l('Public', '公开')}
          </span>
          <time className="entry-time" dateTime={entry.createdAt}>
            {formatDateTime(entry.createdAt)}
          </time>
        </div>

        {entry.text ? <p className="entry-text">{entry.text}</p> : null}

        {entry.photoUrl ? (
          <figure className="entry-photo">
            <img src={entry.photoUrl} alt={entry.text || l('Field photo added by the team', '小队添加的田野照片')} />
            {entry.photoName ? <figcaption>{entry.photoName}</figcaption> : null}
          </figure>
        ) : null}

        {isTeam(role) ? (
          <div className="entry-actions">
            <button type="button" className="text-btn" onClick={() => onToggleVisibility(entry)}>
              <Icon name={teamOnly ? 'eye' : 'lock'} size={14} />
              {teamOnly ? l('Share publicly', '公开分享') : l('Make team-only', '改为仅团队')}
            </button>
            <button type="button" className="text-btn danger" onClick={() => onDelete(entry)}>
              <Icon name="close" size={14} /> {l('Delete', '删除')}
            </button>
          </div>
        ) : null}
      </div>
    </li>
  )
}
