import { STATUS_META, STATUS_ORDER, SOURCE_META } from '../data/seedCases.js'
import { l } from '../lib/text.js'
import Icon from './Icon.jsx'

const STATUS_ZH = {
  active: { label: '进行中的田野研究', short: '进行中' },
  published: { label: '已发布', short: '已发布' },
}

export function statusLabel(status, short = false) {
  const zhMeta = STATUS_ZH[status]
  if (!zhMeta) return STATUS_META[status]?.label ?? ''
  const enMeta = STATUS_META[status]
  return short ? l(enMeta.short, zhMeta.short) : l(enMeta.label, zhMeta.label)
}

export function StatusBadge({ status, size = 'sm' }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  return (
    <span className={`badge badge-${status} badge-${size}`}>
      <span className="badge-dot" aria-hidden="true" />
      {statusLabel(status, true)}
    </span>
  )
}

export function StatusStepper({ status }) {
  const current = STATUS_META[status]?.step ?? 1
  return (
    <ol className="stepper" aria-label={`${l('Publication stage', '发布阶段')}: ${statusLabel(status)}`}>
      {STATUS_ORDER.map((s, i) => (
        <li
          key={s}
          className={`stepper-item ${i + 1 < current ? 'is-done' : ''} ${i + 1 === current ? 'is-current' : ''}`}
        >
          <span className="stepper-mark" aria-hidden="true">
            {i + 1 < current ? <Icon name="check" size={13} strokeWidth={2.4} /> : i + 1}
          </span>
          <span className="stepper-label">{statusLabel(s, true)}</span>
        </li>
      ))}
    </ol>
  )
}

export function SourceBadge({ source, full = false }) {
  const meta = SOURCE_META[source?.kind]
  if (!meta) return null
  return <span className={`source-tag source-tag-${meta.tone}`}>{full ? sourceLabel(source.kind, true) : sourceLabel(source.kind)}</span>
}

export function sourceLabel(kind, full = false) {
  if (kind === 'poster_sample') {
    return full ? l('From original student posters', '源自学生原始海报') : l('Poster sample', '学生海报')
  }
  if (kind === 'student_submission') {
    return full ? l('Published student field study', '已发布的学生田野研究') : l('Student field study', '学生田野研究')
  }
  return full ? l('Fictional demo case — invented for testing', '虚构演示案例 — 仅用于测试') : l('Fictional demo', '虚构演示')
}
