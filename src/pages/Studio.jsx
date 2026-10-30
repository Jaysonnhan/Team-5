import { Link } from 'react-router-dom'
import StudentStudio from './StudentStudio.jsx'
import { useLang } from '../lib/i18n.jsx'
import { l } from '../lib/text.js'

export default function Studio() {
  useLang()

  return (
    <div className="page studio-page">
      <nav className="journey-stages" aria-label={l('Student journey', '学生研究路径')}>
        <Link to="/cases#explore"><span>1</span><strong>{l('Explore', '探索')}</strong></Link>
        <Link to="/studio" className="is-current" aria-current="page"><span>2</span><strong>{l('My field study', '我的田野研究')}</strong></Link>
      </nav>

      <StudentStudio />
    </div>
  )
}
