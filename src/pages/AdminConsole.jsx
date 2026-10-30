import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useLang } from '../lib/i18n.jsx'
import { l } from '../lib/text.js'
import Icon from '../components/Icon.jsx'

const FILTERS = [
  { id: 'all', en: 'All projects', zh: '全部项目' },
  { id: 'final', en: 'Final submissions', zh: '最终提交' },
  { id: 'in-progress', en: 'In progress', zh: '进行中' },
  { id: 'no-files', en: 'No files', zh: '无文件' },
]
const STAGES = [
  { en: 'Idea', zh: '想法' },
  { en: 'Proposal', zh: '方案' },
  { en: 'Journal', zh: '日志' },
  { en: 'Outcomes', zh: '成果' },
]

function formatDate(value, lang) {
  return value
    ? new Date(value).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Metrics({ metrics }) {
  const items = [
    { label: l('Student projects', '学生项目'), value: metrics.totalProjects },
    { label: l('Final submissions', '最终提交'), value: metrics.finalSubmissions },
    { label: l('Published cases', '已发布案例'), value: metrics.publishedProjects },
    { label: l('Submitted journals', '已提交日志'), value: metrics.submittedJournals },
    { label: l('Uploaded files', '已上传文件'), value: metrics.totalFiles },
    { label: l('Local storage', '本地存储'), value: formatBytes(metrics.storageBytes) },
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

function ProjectDetail({ detail, lang }) {
  const { project, files } = detail
  const document = project.document
  const fields = document.fields
  const journals = Array.from({ length: document.days }, (_, index) => index + 1)
    .map((day) => ({ day, journal: document.journals[day] }))
    .filter(({ journal }) => journal && (journal.submitted || journal.observations?.trim()))
  return (
    <article className="admin-detail">
      <header>
        <p className="admin-detail-kicker">
          {project.published ? l('Published case', '已发布案例') : l('Private draft', '私密草稿')} · {l('version', '版本')} {project.version}
        </p>
        <h3>{fields.title || l('Untitled project', '未命名项目')}</h3>
        <p>{fields.destination || l('No destination yet', '尚未填写目的地')} · {fields.team || l('No team name', '尚未填写小队名称')}</p>
      </header>

      <ul className="admin-stages" aria-label={l('Stage completion', '阶段完成情况')}>
        {STAGES.map((label, index) => (
          <li key={label.en} className={document.submitted[index] ? 'is-done' : ''}>
            <span aria-hidden="true">{document.submitted[index] ? <Icon name="check" size={12} strokeWidth={2.4} /> : index + 1}</span>
            {l(label.en, label.zh)}
          </li>
        ))}
      </ul>

      <dl className="admin-facts">
        <div><dt>{l('Research question', '研究问题')}</dt><dd>{fields.question || '—'}</dd></div>
        <div><dt>{l('Team members (private)', '小队成员（私密）')}</dt><dd>{fields.members || '—'}</dd></div>
        <div><dt>{l('Trip duration', '行程天数')}</dt><dd>{document.days} {l('days', '天')}</dd></div>
        <div><dt>{l('Last updated', '最后更新')}</dt><dd>{formatDate(project.updatedAt, lang)}</dd></div>
      </dl>

      <h4>{l('Field journals', '田野日志')}</h4>
      {journals.length ? (
        <ul className="admin-journals">
          {journals.map(({ day, journal }) => (
            <li key={day}>
              <strong>
                {l(`Day ${day}`, `第 ${day} 天`)}{' '}
                {journal.submitted ? <em className="admin-tag">{l('Submitted', '已提交')}</em> : <em className="admin-tag is-draft">{l('Draft', '草稿')}</em>}
              </strong>
              {journal.observations ? <p>{journal.observations}</p> : null}
              {journal.challenges ? <p><b>{l('Challenges:', '挑战：')}</b> {journal.challenges}</p> : null}
              {journal.response ? <p><b>{l('Response:', '调整：')}</b> {journal.response}</p> : null}
            </li>
          ))}
        </ul>
      ) : <p className="admin-empty">{l('No journal entries yet.', '还没有日志记录。')}</p>}

      <h4>{l('Uploaded files', '已上传文件')}</h4>
      {files.length ? (
        <ul className="admin-files">
          {files.map((file) => (
            <li key={file.id}>
              <span className="admin-file-kind">{file.kind}</span>
              <a href={file.previewUrl || file.url} target="_blank" rel="noreferrer">{file.name}</a>
              <span>{file.kind === 'photos' ? `${l('Day', '第')} ${file.day}${lang === 'zh' ? ' 天' : ''} · ` : ''}{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="admin-empty">{l('No files uploaded yet.', '还没有上传文件。')}</p>}
    </article>
  )
}

export default function AdminConsole() {
  const { lang } = useLang()
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
    return <section className="admin-console admin-state"><p>{l('Loading the program console…', '正在加载项目管理台…')}</p></section>
  }

  if (status === 'signedOut' || status === 'forbidden' || status === 'error') {
    return (
      <section className="admin-console admin-state">
        <p className="eyebrow">{l('PROGRAM CONSOLE', '项目管理台')}</p>
        <h1 className="page-title">
          {status === 'forbidden'
            ? l('This account is not an administrator.', '该账号不是管理员。')
            : status === 'error'
              ? l('Console unavailable.', '管理台暂不可用。')
              : l('Sign in to open the console.', '登录后即可打开管理台。')}
        </h1>
        <p className="page-lede">
          {status === 'forbidden'
            ? l(
                `${email} can use the student studio but cannot read team projects. Administrators are the first local account and any email listed in ADMIN_EMAILS.`,
                `${email} 可以使用学生创作台，但无法查看小队项目。管理员是本地第一个注册账号，以及 ADMIN_EMAILS 中列出的邮箱。`,
              )
            : status === 'error'
              ? message
              : l('The program console is read-only and only visible to administrator accounts. Sign in through the student studio first.', '项目管理台为只读视图，仅管理员账号可见。请先通过学生创作台登录。')}
        </p>
        <Link className="btn btn-primary" to="/cases">{l('Go to the student studio', '前往学生创作台')} <Icon name="arrow" size={15} /></Link>
      </section>
    )
  }

  return (
    <div className="page admin-console">
      <header className="admin-head">
        <div>
          <p className="eyebrow">03 / {l('PROGRAM CONSOLE', '项目管理台')}</p>
          <h1 className="page-title">{l('Every team, one calm overview.', '所有小队，一屏尽览。')}</h1>
          <p className="page-lede">
            {l(
              'A read-only view of student projects, journals and uploaded files. Nothing here changes or publishes student work.',
              '只读查看学生项目、日志与上传文件，这里不会修改或发布学生的作品。',
            )}
          </p>
        </div>
        <div className="admin-head-meta">
          <span><Icon name="lock" size={14} /> {l('Signed in as', '当前账号')} {email}</span>
          <Link className="btn btn-secondary" to="/cases">{l('Back to the library', '返回案例库')}</Link>
        </div>
      </header>

      {metrics ? <Metrics metrics={metrics} /> : null}

      <div className="admin-toolbar">
        <label className="admin-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={l('Search team, destination or question', '搜索小队、目的地或研究问题')}
            aria-label={l('Search projects', '搜索项目')}
          />
        </label>
        <div className="admin-filters" role="group" aria-label={l('Filter projects', '筛选项目')}>
          {FILTERS.map((item) => (
            <button type="button" key={item.id} className={filter === item.id ? 'is-on' : ''} onClick={() => setFilter(item.id)}>
              {l(item.en, item.zh)}
            </button>
          ))}
        </div>
      </div>

      {listError ? <p className="studio-message is-error" role="alert">{listError}</p> : null}

      <div className="admin-layout">
        <section className="admin-list" aria-label={l('Student projects', '学生项目')}>
          <header>
            <span>{l(`${total} ${total === 1 ? 'project' : 'projects'}`, `${total} 个项目`)}</span>
            <span>{l('Updated', '更新时间')}</span>
          </header>
          {projects.length ? (
            <ul>
              {projects.map((project) => (
                <li key={project.id}>
                  <button type="button" className={selectedId === project.id ? 'is-selected' : ''} onClick={() => setSelectedId(project.id)}>
                    <strong>{project.team}</strong>
                    <span>{project.destination || l('No destination', '未填写目的地')}{project.question ? ` · ${project.question}` : ''}</span>
                    <span className="admin-list-meta">
                      {project.published ? <em className="admin-tag">{l('Published', '已发布')}</em> : <em className="admin-tag is-draft">{l('Private', '私密')}</em>}
                      {l(
                        `${project.journalSubmitted} ${project.journalSubmitted === 1 ? 'journal' : 'journals'} · ${project.fileCount} ${project.fileCount === 1 ? 'file' : 'files'} · ${formatDate(project.updatedAt, lang)}`,
                        `${project.journalSubmitted} 篇日志 · ${project.fileCount} 个文件 · ${formatDate(project.updatedAt, lang)}`,
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="admin-empty">{l('No projects match this view yet.', '当前视图没有匹配的项目。')}</p>}
        </section>

        <section className="admin-view" aria-live="polite">
          {detail ? <ProjectDetail detail={detail} lang={lang} /> : <p className="admin-empty">{l('Select a project to review its stages.', '选择一个项目查看它的阶段。')}</p>}
        </section>
      </div>
    </div>
  )
}
