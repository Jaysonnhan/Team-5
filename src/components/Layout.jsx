import { NavLink } from 'react-router-dom'
import { useAppState } from '../lib/AppState.jsx'
import { ROLES } from '../lib/visibility.js'
import { PROGRAM } from '../lib/program.js'

export default function Layout({ children }) {
  const { role, setRole } = useAppState()

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/cases" className="brand" aria-label="Dream Journey case library home">
            <span className="brand-text">
              <span className="brand-name">Dream Journey</span>
              <span className="brand-sub">Adream · {role === 'team' ? 'Student Studio' : 'Case Library'}</span>
            </span>
          </NavLink>

          <div className="role-switcher">
            <div className="role-segment" role="group" aria-label="Choose a view">
              {Object.values(ROLES).map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={`role-btn ${role === view.id ? 'is-active' : ''}`}
                  aria-pressed={role === view.id}
                  title={view.hint}
                  onClick={() => setRole(view.id)}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <a className="program-credit" href={PROGRAM.url} target="_blank" rel="noreferrer">
          <strong>Go Far · Adream Foundation</strong>
          <em>Official programme page ↗</em>
        </a>
        <span className="role-current">
          Student drafts stay private · Only published field studies appear in the public library
        </span>
      </footer>
    </div>
  )
}
