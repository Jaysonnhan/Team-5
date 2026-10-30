import { NavLink } from 'react-router-dom'
import { useAppState } from '../lib/AppState.jsx'
import { useLang } from '../lib/i18n.jsx'
import { l } from '../lib/text.js'
import { ROLES, roleHint, roleLabel } from '../lib/visibility.js'
import { PROGRAM } from '../lib/program.js'

export default function Layout({ children }) {
  const { role, setRole } = useAppState()
  const { lang, toggle } = useLang()

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/cases" className="brand" aria-label={l('Dream Journey case library home', '去远方案例库首页')}>
            <span className="brand-text">
              <span className="brand-name">{l('Dream Journey', '去远方')}</span>
              <span className="brand-sub">
                Adream · {role === 'team' ? l('Student Studio', '学生创作台') : l('Case Library', '案例库')}
              </span>
            </span>
          </NavLink>

          <div className="role-switcher">
            <div className="role-segment" role="group" aria-label={l('Choose a view', '选择视图')}>
              {Object.values(ROLES).map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={`role-btn ${role === view.id ? 'is-active' : ''}`}
                  aria-pressed={role === view.id}
                  title={roleHint(view.id)}
                  onClick={() => setRole(view.id)}
                >
                  {roleLabel(view.id)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lang-toggle"
              onClick={toggle}
              aria-label={l('Switch to Chinese', '切换到英文')}
              title={l('Switch to Chinese', '切换到英文')}
            >
              <span aria-hidden="true">文</span>
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <a className="program-credit" href={PROGRAM.url} target="_blank" rel="noreferrer">
          <strong>Go Far · Adream Foundation</strong>
          <em>{l('Official programme page ↗', '前往项目官网 ↗')}</em>
        </a>
        <span className="role-current">
          {l(
            'Student drafts stay private · Only published field studies appear in the public library',
            '学生草稿保持私密 · 公开案例库仅展示已发布的田野研究',
          )}
        </span>
      </footer>
    </div>
  )
}
