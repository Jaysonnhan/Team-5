import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import Icon from '../components/Icon.jsx'

const FILTERS = [
  { id: 'all', label: 'All projects' },
  { id: 'final', label: 'Final submissions' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'no-files', label: 'No files' },
]
const STAGES = ['Idea', 'Proposal', 'Journal', 'Outcomes']

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Metrics({ metrics }) {
  const items = [
    { label: 'Student projects', value: metrics.totalProjects },
    { label: 'Final submissions', value: metrics.finalSubmissions },
    { label: 'Published cases', value: metrics.publishedProjects },
    { label: 'Submitted journals', value: metrics.submittedJournals },
    { label: 'Uploaded files', value: metrics.totalFiles },
    { label: 'Local storage', value: formatBytes(metrics.storageBytes) },
  ]
  return (
    <dl className="admin-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ProjectDetail({ detail }) {
  const { project, files } = detail
  const document = project.document
  const fields = document.fields
  const journals = Array.from({ length: document.days }, (_, index) => index + 1)
    .map((day) => ({ day, journal: document.journals[day] }))
    .filter(({ journal }) => journal && (journal.submitted || journal.observations?.trim()))
  return (
    <article className="admin-detail">
      <header>
        <p className="admin-detail-kicker">{project.published ? 'Published case' : 'Private draft'} · version {project.version}</p>
        <h3>{fields.title || 'Untitled project'}</h3>
        <p>{fields.destination || 'No destination yet'} · {fields.team || 'No team name'}</p>
      </header>

      <ul className="admin-stages" aria-label="Stage completion">
        {STAGES.map((label, index) => (
          <li key={label} className={document.submitted[index] ? 'is-done' : ''}>
            <span aria-hidden="true">{document.submitted[index] ? <Icon name="check" size={12} strokeWidth={2.4} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ul>

      <dl className="admin-facts">
        <div><dt>Research question</dt><dd>{fields.question || '—'}</dd></div>
        <div><dt>Team members (private)</dt><dd>{fields.members || '—'}</dd></div>
        <div><dt>Trip duration</dt><dd>{document.days} {document.days === 1 ? 'day' : 'days'}</dd></div>
        <div><dt>Last updated</dt><dd>{formatDate(project.updatedAt)}</dd></div>
      </dl>

      <h4>Field journals</h4>
      {journals.length ? (
        <ul className="admin-journals">
          {journals.map(({ day, journal }) => (
            <li key={day}>
              <strong>Day {day} {journal.submitted ? <em className="admin-tag">Submitted</em> : <em className="admin-tag is-draft">Draft</em>}</strong>
              {journal.observations ? <p>{journal.observations}</p> : null}
              {journal.challenges ? <p><b>Challenges:</b> {journal.challenges}</p> : null}
              {journal.response ? <p><b>Response:</b> {journal.response}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="admin-empty">No journal entries yet.</p>}

      <h4>Uploaded files</h4>
      {files.length ? (
        <ul className="admin-files">
          {files.map((file) => (
            <li key={file.id}>
              <span className="admin-file-kind">{file.kind}</span>
              <a href={file.previewUrl || file.url} target="_blank" rel="noreferrer">{file.name}</a>
              <span>{file.kind === 'photos' ? `Day ${file.day} · ` : ''}{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="admin-empty">No files uploaded yet.</p>}
    </article>
  )
}

export default function AdminConsole() {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [listError, setListError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.session()
      .then((session) => {
        if (cancelled) return
        if (!session.authenticated) {
          setStatus('signedOut')
          return
        }
        if (!session.administrator) {
          setEmail(session.user?.email || '')
          setStatus('forbidden')
          return
        }
        setEmail(session.user?.email || '')
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setMessage(error.message)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (status !== 'ready') return undefined
    let cancelled = false
    const timer = setTimeout(() => {
      Promise.all([api.adminOverview(), api.adminProjects({ query, status: filter })])
        .then(([overview, listing]) => {
          if (cancelled) return
          setMetrics(overview.metrics)
          setProjects(listing.projects)
          setTotal(listing.total)
          setListError('')
          setSelectedId((current) => current || listing.projects[0]?.id || '')
        })
        .catch((error) => { if (!cancelled) setListError(error.message) })
    }, 200)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [status, query, filter])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return undefined }
    let cancelled = false
    api.adminProject(selectedId)
      .then((data) => { if (!cancelled) setDetail(data) })
      .catch((error) => { if (!cancelled) setListError(error.message) })
    return () => { cancelled = true }
  }, [selectedId])

  if (status === 'loading') {
    return <section className="admin-console admin-state"><p>Loading the program console…</p></section>
  }

  if (status === 'signedOut' || status === 'forbidden' || status === 'error') {
    return (
      <section className="admin-console admin-state">
        <p className="eyebrow">PROGRAM CONSOLE</p>
        <h1 className="page-title">{status === 'forbidden' ? 'This account is not an administrator.' : status === 'error' ? 'Console unavailable.' : 'Sign in to open the console.'}</h1>
        <p className="page-lede">
          {status === 'forbidden'
            ? `${email} can use the student studio but cannot read team projects. Administrators are the first local account and any email listed in ADMIN_EMAILS.`
            : status === 'error'
              ? message
              : 'The program console is read-only and only visible to administrator accounts. Sign in through the student studio first.'}
        </p>
        <Link className="btn btn-primary" to="/cases">Go to the student studio <Icon name="arrow" size={15} /></Link>
      </section>
    )
  }

  return (
    <div className="page admin-console">
      <header className="admin-head">
        <div>
          <p className="eyebrow">03 / PROGRAM CONSOLE</p>
          <h1 className="page-title">Every team, one calm overview.</h1>
          <p className="page-lede">A read-only view of student projects, journals and uploaded files. Nothing here changes or publishes student work.</p>
        </div>
        <div className="admin-head-meta">
          <span><Icon name="lock" size={14} /> Signed in as {email}</span>
          <Link className="btn btn-secondary" to="/cases">Back to the library</Link>
        </div>
      </header>

      {metrics ? <Metrics metrics={metrics} /> : null}

      <div className="admin-toolbar">
        <label className="admin-search">
          <Icon name="search" size={17} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team, destination or question" aria-label="Search projects" />
        </label>
        <div className="admin-filters" role="group" aria-label="Filter projects">
          {FILTERS.map((item) => (
            <button type="button" key={item.id} className={filter === item.id ? 'is-on' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
      </div>

      {listError ? <p className="studio-message is-error" role="alert">{listError}</p> : null}

      <div className="admin-layout">
        <section className="admin-list" aria-label="Student projects">
          <header><span>{total} {total === 1 ? 'project' : 'projects'}</span><span>Updated</span></header>
          {projects.length ? (
            <ul>
              {projects.map((project) => (
                <li key={project.id}>
                  <button type="button" className={selectedId === project.id ? 'is-selected' : ''} onClick={() => setSelectedId(project.id)}>
                    <strong>{project.team}</strong>
                    <span>{project.destination || 'No destination'}{project.question ? ` · ${project.question}` : ''}</span>
                    <span className="admin-list-meta">
                      {project.published ? <em className="admin-tag">Published</em> : <em className="admin-tag is-draft">Private</em>}
                      {project.journalSubmitted} {project.journalSubmitted === 1 ? 'journal' : 'journals'} · {project.fileCount} {project.fileCount === 1 ? 'file' : 'files'} · {formatDate(project.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="admin-empty">No projects match this view yet.</p>}
        </section>

        <section className="admin-view" aria-live="polite">
          {detail ? <ProjectDetail detail={detail} /> : <p className="admin-empty">Select a project to review its stages.</p>}
        </section>
      </div>
    </div>
  )
}
