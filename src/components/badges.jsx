import { STATUS_META, STATUS_ORDER, SOURCE_META } from '../data/seedCases.js'
import Icon from './Icon.jsx'

export function StatusBadge({ status, size = 'sm' }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  return (
    <span className={`badge badge-${status} badge-${size}`}>
      <span className="badge-dot" aria-hidden="true" />
      {meta.short}
    </span>
  )
}

export function StatusStepper({ status }) {
  const current = STATUS_META[status]?.step ?? 1
  return (
    <ol className="stepper" aria-label={`Publication stage: ${STATUS_META[status]?.label}`}>
      {STATUS_ORDER.map((s, i) => (
        <li
          key={s}
          className={`stepper-item ${i + 1 < current ? 'is-done' : ''} ${i + 1 === current ? 'is-current' : ''}`}
        >
          <span className="stepper-mark" aria-hidden="true">
            {i + 1 < current ? <Icon name="check" size={13} strokeWidth={2.4} /> : i + 1}
          </span>
          <span className="stepper-label">{STATUS_META[s].short}</span>
        </li>
      ))}
    </ol>
  )
}

export function SourceBadge({ source, full = false }) {
  const meta = SOURCE_META[source?.kind]
  if (!meta) return null
  return <span className={`source-tag source-tag-${meta.tone}`}>{full ? meta.label : short(source.kind)}</span>
}

function short(kind) {
  if (kind === 'poster_sample') return 'Poster sample'
  if (kind === 'student_submission') return 'Student field study'
  return 'Fictional demo'
}
