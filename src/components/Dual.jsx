import { t, zh } from '../lib/text.js'

export default function Dual({ v, className = '', original = false }) {
  const source = original ? zh(v) : ''
  return (
    <span className={className}>
      {t(v)}
      {source ? <span className="zh-line">{source}</span> : null}
    </span>
  )
}
