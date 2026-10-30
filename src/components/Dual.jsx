import { t } from '../lib/text.js'

export default function Dual({ v, className = '' }) {
  return <span className={className}>{t(v)}</span>
}
