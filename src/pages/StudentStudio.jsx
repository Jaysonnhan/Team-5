import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAppState } from '../lib/AppState.jsx'
import { useLang } from '../lib/i18n.jsx'
import { l } from '../lib/text.js'
import Icon from '../components/Icon.jsx'

const STAGES = [
  { en: 'Idea', zh: '想法' },
  { en: 'Proposal', zh: '方案' },
  { en: 'Journal', zh: '日志' },
  { en: 'Outcomes', zh: '成果' },
]
const EMPTY_JOURNAL = { observations: '', challenges: '', response: '', photoNote: '', submitted: false }

const stageLabel = (index) => l(STAGES[index].en, STAGES[index].zh)

function Field({ label, hint, children }) {
  return (
    <label className="studio-field">
      <span className="studio-field-label">{label}</span>
      {hint ? <span className="studio-field-hint">{hint}</span> : null}
      {children}
    </label>
  )
}

function FileList({ files, kind, day, busy, onDelete }) {
  const visible = files.filter((file) => file.kind === kind && (kind !== 'photos' || file.day === day))
  if (!visible.length) return <p className="studio-empty">{l('No files added yet.', '还没有添加文件。')}</p>
  return (
    <ul className="studio-files">
      {visible.map((file) => (
        <li key={file.id}>
          <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a>
          <span>{Math.max(1, Math.round(file.size / 1024))} KB</span>
          <button type="button" className="text-btn danger" disabled={busy} onClick={() => onDelete(file)}>{l('Remove', '移除')}</button>
        </li>
      ))}
    </ul>
  )
}

export default function StudentStudio() {
  useLang()
  const { refreshCases } = useAppState()
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [project, setProject] = useState(null)
  const [draft, setDraft] = useState(null)
  const [files, setFiles] = useState([])
  const [stage, setStage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const trackRef = useRef(null)
  const scrollLockUntil = useRef(0)

  async function loadWorkspace() {
    setError('')
    const session = await api.session()
    if (!session.authenticated) {
      setStatus('signedOut')
      return
    }
    setUser(session.user)
    const [{ project: cloudProject, emptyDocument }, fileData] = await Promise.all([api.getProject(), api.getFiles()])
    setProject(cloudProject)
    setDraft(cloudProject?.document || emptyDocument)
    setFiles(fileData.files)
    setStatus('signedIn')
  }

  useEffect(() => {
    loadWorkspace().catch((loadError) => {
      setError(loadError.message)
      setStatus('error')
    })
  }, [])

  async function authenticate(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await (authMode === 'register' ? api.register(email, password) : api.login(email, password))
      await loadWorkspace()
      setPassword('')
    } catch (authError) {
      setError(authError.message)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    await api.logout().catch(() => null)
    setUser(null)
    setProject(null)
    setDraft(null)
    setFiles([])
    setStatus('signedOut')
    setBusy(false)
  }

  function applyProject(nextProject) {
    setProject(nextProject)
    setDraft(nextProject.document)
  }

  async function save(nextDraft = draft, message = l('Cloud draft saved.', '云端草稿已保存。')) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.saveProject(project?.version || 0, nextDraft)
      const wasPublished = project?.published
      applyProject(result.project)
      setNotice(message)
      if (wasPublished || result.project.published) await refreshCases()
      return result.project
    } catch (saveError) {
      setError(
        saveError.status === 409
          ? `${saveError.message} ${l('Your current text is still on this screen.', '你当前填写的内容仍保留在页面上。')}`
          : saveError.message,
      )
      return null
    } finally {
      setBusy(false)
    }
  }

  function updateField(key, value) {
    setDraft((current) => ({ ...current, fields: { ...current.fields, [key]: value } }))
  }

  function updateJournal(key, value) {
    setDraft((current) => ({
      ...current,
      journals: {
        ...current.journals,
        [current.selectedDay]: { ...EMPTY_JOURNAL, ...current.journals[current.selectedDay], [key]: value },
      },
    }))
  }

  function changeDays(value) {
    const days = Math.max(1, Math.min(30, Number(value) || 1))
    setDraft((current) => ({
      ...current,
      days,
      selectedDay: Math.min(current.selectedDay, days),
      journals: Object.fromEntries(Object.entries(current.journals).filter(([day]) => Number(day) <= days)),
    }))
  }

  async function submitStage(index) {
    const submitted = [...draft.submitted]
    submitted[index] = true
    const saved = await save(
      { ...draft, submitted, shareWithLibrary: index === 3 ? true : draft.shareWithLibrary },
      index === 3
        ? l('Your case is now live in the public library.', '你的案例已在公开案例库上线。')
        : l(`${stageLabel(index)} submitted.`, `${stageLabel(index)}已提交。`),
    )
    if (saved && index < 3) goToStage(index + 1)
  }

  async function submitJournal() {
    const day = draft.selectedDay
    const journal = { ...EMPTY_JOURNAL, ...draft.journals[day], submitted: true }
    const submitted = [...draft.submitted]
    submitted[2] = true
    await save(
      { ...draft, journals: { ...draft.journals, [day]: journal }, submitted },
      l(`Day ${day} journal submitted.`, `第 ${day} 天日志已提交。`),
    )
  }

  async function upload(event, kind) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const saved = await save(draft, l('Draft saved. Uploading file…', '草稿已保存，正在上传文件…'))
    if (!saved) return
    setBusy(true)
    setError('')
    try {
      const result = await api.uploadFile(file, kind, draft.selectedDay, saved.version)
      applyProject(result.project)
      setFiles((current) => [...current, result.file])
      setNotice(l('File uploaded. Resubmit this stage before publishing again.', '文件已上传。再次发布前请重新提交这一阶段。'))
      if (saved.published) await refreshCases()
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeFile(file) {
    const confirmed = window.confirm(
      l(
        `Remove ${file.name}? This will also withdraw the affected submission.`,
        `移除 ${file.name}？相关阶段的提交也会一并撤回。`,
      ),
    )
    if (!confirmed) return
    setBusy(true)
    setError('')
    try {
      const result = await api.deleteFile(file.id, project.version)
      applyProject(result.project)
      setFiles((current) => current.filter((item) => item.id !== file.id))
      setNotice(l('File removed. The affected stage needs to be submitted again.', '文件已移除，相关阶段需要重新提交。'))
      if (project.published) await refreshCases()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    await save({ ...draft, shareWithLibrary: false }, l('The case is private again. Your cloud draft is unchanged.', '案例已转为私密，云端草稿保持不变。'))
  }

  function goToStage(index) {
    const next = Math.max(0, Math.min(STAGES.length - 1, index))
    setStage(next)
    const track = trackRef.current
    if (track && track.scrollWidth > track.clientWidth + 4) {
      scrollLockUntil.current = Date.now() + 700
      track.scrollTo({ left: track.clientWidth * next, behavior: 'smooth' })
    }
  }

  function handleTrackScroll(event) {
    if (Date.now() < scrollLockUntil.current) return
    const track = event.currentTarget
    if (track.scrollWidth <= track.clientWidth + 4) return
    const index = Math.round(track.scrollLeft / track.clientWidth)
    if (index !== stage) setStage(index)
  }

  if (status === 'loading') {
    return <section className="student-studio studio-state" id="studio"><p>{l('Loading your student studio…', '正在加载学生创作台…')}</p></section>
  }

  if (status === 'error') {
    return (
      <section className="student-studio studio-state" id="studio">
        <h2>{l('Student studio unavailable', '学生创作台暂时不可用')}</h2>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => { setStatus('loading'); loadWorkspace().catch((loadError) => { setError(loadError.message); setStatus('error') }) }}>{l('Try again', '重试')}</button>
      </section>
    )
  }

  if (status === 'signedOut') {
    return (
      <section className="student-studio" id="studio">
        <div className="studio-auth-copy">
          <p className="eyebrow">02 / {l('YOUR FIELD STUDY', '你的田野研究')}</p>
          <h2 className="page-title">{l('Keep every discovery.', '留住每一次发现。')}</h2>
          <p className="page-lede">
            {l(
              'Create one account for your team to save a cloud draft, upload field files and publish a complete case.',
              '为小队创建一个账号，保存云端草稿、上传田野文件，并发布完整案例。',
            )}
          </p>
          <ul className="studio-benefits">
            <li><Icon name="check" size={16} /> {l('Continue on another device', '换一台设备也能继续')}</li>
            <li><Icon name="check" size={16} /> {l('Keep drafts and member names private', '草稿与成员姓名保持私密')}</li>
            <li><Icon name="check" size={16} /> {l('Share only when your outcomes are ready', '等成果准备好再分享')}</li>
          </ul>
        </div>
        <form className="studio-auth" onSubmit={authenticate}>
          <div className="segmented-control" role="group" aria-label={l('Account action', '账号操作')}>
            <button type="button" className={authMode === 'login' ? 'is-on' : ''} onClick={() => setAuthMode('login')}>{l('Sign in', '登录')}</button>
            <button type="button" className={authMode === 'register' ? 'is-on' : ''} onClick={() => setAuthMode('register')}>{l('Create account', '创建账号')}</button>
          </div>
          <Field label={l('Team email', '小队邮箱')}>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="team@example.com" />
          </Field>
          <Field label={l('Password', '密码')} hint={l('At least 10 characters', '至少 10 个字符')}>
            <input type="password" required minLength={10} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error ? <p className="studio-message is-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? l('Please wait…', '请稍候…') : authMode === 'register' ? l('Create account & continue', '创建账号并继续') : l('Sign in & continue', '登录并继续')}
          </button>
          <p className="studio-privacy">
            <Icon name="lock" size={14} /> {l('Passwords are salted and hashed. Sessions use secure, HTTP-only cookies.', '密码经过加盐哈希处理，会话使用安全的 HTTP-only Cookie。')}
          </p>
        </form>
      </section>
    )
  }

  if (!draft) return null
  const journal = { ...EMPTY_JOURNAL, ...draft.journals[draft.selectedDay] }
  const proposalFiles = files.filter((file) => file.kind === 'proposal')
  const outcomeFiles = files.filter((file) => file.kind === 'outcomes')
  const submittedJournals = Object.values(draft.journals).filter((item) => item.submitted).length
  const journalComplete = submittedJournals > 0
  const complete = [draft.submitted[0], draft.submitted[1], journalComplete, draft.submitted[3]]
  const canSubmit = [
    true,
    proposalFiles.length > 0,
    journal.observations.trim().length > 0,
    outcomeFiles.length >= 2 && journalComplete,
  ][stage]
  const submitCurrent = () => (stage === 2 ? submitJournal() : submitStage(stage))

  return (
    <section className="student-studio student-studio-signed-in" id="studio">
      <div className="studio-heading">
        <div>
          <p className="eyebrow">02 / {l('YOUR FIELD STUDY', '你的田野研究')}</p>
          <h2 className="page-title">{l('From first question to shared story.', '从第一个问题，到共同讲述的故事。')}</h2>
          <p className="page-lede">
            {l(
              `Signed in as ${user.email}. Save each stage as a cloud draft, then submit it when ready.`,
              `已登录：${user.email}。每个阶段都可以先存为云端草稿，准备好后再提交。`,
            )}
          </p>
        </div>
        <div className="studio-heading-actions">
          {user.administrator ? <Link className="btn btn-secondary" to="/admin"><Icon name="eye" size={15} /> {l('Program console', '项目管理台')}</Link> : null}
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={signOut}>{l('Sign out', '退出登录')}</button>
        </div>
      </div>

      <nav className="studio-stages" aria-label={l('Project stages', '项目阶段')}>
        {STAGES.map((label, index) => (
          <button type="button" key={label.en} className={`${stage === index ? 'is-current' : ''} ${complete[index] ? 'is-complete' : ''}`} onClick={() => goToStage(index)}>
            <span>{complete[index] ? <Icon name="check" size={15} /> : index + 1}</span>
            <strong>{l(label.en, label.zh)}</strong>
            <small>{complete[index] ? l('Submitted', '已提交') : l('In progress', '进行中')}</small>
          </button>
        ))}
      </nav>
      <p className="studio-stage-hint">{l('Swipe sideways to move between stages', '左右滑动切换阶段')}</p>

      {error ? (
        <div className="studio-message is-error" role="alert">
          <span>{error}</span>
          {error.includes('newer') || error.includes('Reload') ? <button type="button" className="text-btn" onClick={loadWorkspace}>{l('Reload cloud version', '重新加载云端版本')}</button> : null}
        </div>
      ) : null}
      {notice ? <p className="studio-message is-success" role="status">{notice}</p> : null}

      <div className="studio-editor studio-track" ref={trackRef} onScroll={handleTrackScroll}>
        <div className={`studio-panel ${stage === 0 ? 'is-current' : ''}`}>
          <div className="studio-form">
            <div className="studio-form-heading">
              <span>01</span>
              <div>
                <h3>{l('Start with a real question.', '从一个真实的问题开始。')}</h3>
                <p>{l('Team members stay private and never appear in the public case.', '小队成员信息保持私密，不会出现在公开案例中。')}</p>
              </div>
            </div>
            <Field label={l('Project title', '项目标题')}>
              <input value={draft.fields.title} onChange={(event) => updateField('title', event.target.value)} placeholder={l('What is your field study called?', '你的田野研究叫什么？')} />
            </Field>
            <div className="studio-two-col">
              <Field label={l('Team name', '小队名称')}><input value={draft.fields.team} onChange={(event) => updateField('team', event.target.value)} /></Field>
              <Field label={l('Destination', '目的地')}><input value={draft.fields.destination} onChange={(event) => updateField('destination', event.target.value)} /></Field>
            </div>
            <Field label={l('Team members', '小队成员')} hint={l('Private — used only for team accountability', '私密 — 仅用于小队内部确认')}>
              <input value={draft.fields.members} onChange={(event) => updateField('members', event.target.value)} />
            </Field>
            <Field label={l('Project summary', '项目摘要')}>
              <textarea rows={4} value={draft.fields.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder={l('What will you explore, and why does it matter to your team?', '你们想探索什么？为什么这对你们的小队重要？')} />
            </Field>
            <Field label={l('Themes', '主题')} hint={l('Separate themes with commas', '用逗号分隔多个主题')}>
              <input value={draft.fields.themes} onChange={(event) => updateField('themes', event.target.value)} placeholder={l('Environment, Community voice, Education', '环境, 社区声音, 教育')} />
            </Field>
            <Field label={l('Main research question', '核心研究问题')}>
              <textarea rows={3} value={draft.fields.question} onChange={(event) => updateField('question', event.target.value)} />
            </Field>
            <Field label={l('Follow-up questions', '延伸问题')} hint={l('One question per line', '每行一个问题')}>
              <textarea rows={4} value={draft.fields.specifics} onChange={(event) => updateField('specifics', event.target.value)} />
            </Field>
            <button type="button" className="btn btn-primary studio-panel-submit" disabled={busy} onClick={() => submitStage(0)}>{l('Submit idea & continue', '提交想法并继续')} <Icon name="arrow" size={15} /></button>
          </div>
        </div>

        <div className={`studio-panel ${stage === 1 ? 'is-current' : ''}`}>
          <div className="studio-form">
            <div className="studio-form-heading">
              <span>02</span>
              <div>
                <h3>{l('Make a plan you can follow.', '制定一份可执行的计划。')}</h3>
                <p>{l('Add your methods and a proposal file before submitting this stage.', '提交这一阶段前，请填写研究方法并上传方案文件。')}</p>
              </div>
            </div>
            <Field label={l('Research methods', '研究方法')} hint={l('One method per line', '每行一种方法')}>
              <textarea rows={5} value={draft.fields.methods} onChange={(event) => updateField('methods', event.target.value)} placeholder={l('Field observation\nInterviews\nPhoto documentation', '田野观察\n访谈\n影像记录')} />
            </Field>
            <Field label={l('Proposal notes', '方案说明')}>
              <textarea rows={6} value={draft.fields.proposalNote} onChange={(event) => updateField('proposalNote', event.target.value)} placeholder={l('Your route, schedule, roles, equipment and preparation.', '路线、日程、分工、设备与准备工作。')} />
            </Field>
            <div className="studio-upload">
              <div>
                <h4>{l('Proposal file', '方案文件')}</h4>
                <p>{l('PDF, DOC, DOCX or image · up to 15 MB', 'PDF、DOC、DOCX 或图片 · 最大 15 MB')}</p>
              </div>
              <label className="btn btn-secondary">{l('Add proposal file', '添加方案文件')}<input type="file" hidden disabled={busy} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.avif" onChange={(event) => upload(event, 'proposal')} /></label>
            </div>
            <FileList files={files} kind="proposal" busy={busy} onDelete={removeFile} />
            <button type="button" className="btn btn-primary studio-panel-submit" disabled={busy || !proposalFiles.length} onClick={() => submitStage(1)}>{l('Submit proposal & continue', '提交方案并继续')} <Icon name="arrow" size={15} /></button>
          </div>
        </div>

        <div className={`studio-panel ${stage === 2 ? 'is-current' : ''}`}>
          <div className="studio-form">
            <div className="studio-form-heading">
              <span>03</span>
              <div>
                <h3>{l('Record what actually happened.', '记录真实发生的过程。')}</h3>
                <p>{l('Only journals you submit will be included in a published case.', '只有你提交的日志才会进入公开案例。')}</p>
              </div>
            </div>
            <Field label={l('Trip duration', '行程天数')} hint={l('1–30 days', '1–30 天')}>
              <input type="number" min={1} max={30} value={draft.days} onChange={(event) => changeDays(event.target.value)} />
            </Field>
            <div className="studio-day-tabs" role="group" aria-label={l('Journal day', '日志日期')}>
              {Array.from({ length: draft.days }, (_, index) => index + 1).map((day) => (
                <button type="button" key={day} className={draft.selectedDay === day ? 'is-on' : ''} onClick={() => setDraft((current) => ({ ...current, selectedDay: day }))}>
                  {l(`Day ${day}`, `第 ${day} 天`)}{draft.journals[day]?.submitted ? <Icon name="check" size={12} /> : null}
                </button>
              ))}
            </div>
            <Field label={l(`Day ${draft.selectedDay} discoveries`, `第 ${draft.selectedDay} 天的发现`)}>
              <textarea rows={5} value={journal.observations} onChange={(event) => updateJournal('observations', event.target.value)} placeholder={l('What did you see, hear or learn?', '你看到了什么、听到了什么、学到了什么？')} />
            </Field>
            <Field label={l('Challenges', '遇到的挑战')}>
              <textarea rows={3} value={journal.challenges} onChange={(event) => updateJournal('challenges', event.target.value)} />
            </Field>
            <Field label={l('What did you change or do next?', '你做了哪些调整或下一步行动？')}>
              <textarea rows={3} value={journal.response} onChange={(event) => updateJournal('response', event.target.value)} />
            </Field>
            <Field label={l('Field photo note', '田野照片说明')}>
              <input value={journal.photoNote} onChange={(event) => updateJournal('photoNote', event.target.value)} placeholder={l('What should a viewer notice in this photo?', '希望读者在这张照片里注意什么？')} />
            </Field>
            <div className="studio-upload">
              <div>
                <h4>{l(`Day ${draft.selectedDay} photos`, `第 ${draft.selectedDay} 天照片`)}</h4>
                <p>{l('PNG, JPEG, WebP, GIF, HEIC or AVIF · up to 15 MB', 'PNG、JPEG、WebP、GIF、HEIC 或 AVIF · 最大 15 MB')}</p>
              </div>
              <label className="btn btn-secondary">{l('Add field photo', '添加田野照片')}<input type="file" hidden disabled={busy} accept=".png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.avif" onChange={(event) => upload(event, 'photos')} /></label>
            </div>
            <FileList files={files} kind="photos" day={draft.selectedDay} busy={busy} onDelete={removeFile} />
            <button type="button" className="btn btn-primary studio-panel-submit" disabled={busy || !journal.observations.trim()} onClick={submitJournal}>
              {l(`Submit day ${draft.selectedDay} journal`, `提交第 ${draft.selectedDay} 天日志`)}
            </button>
            <button type="button" className="text-btn studio-next" onClick={() => goToStage(3)}>{l('Continue to outcomes', '继续填写成果')} <Icon name="arrow" size={14} /></button>
          </div>
        </div>

        <div className={`studio-panel ${stage === 3 ? 'is-current' : ''}`}>
          <div className="studio-form">
            <div className="studio-form-heading">
              <span>04</span>
              <div>
                <h3>{l('Turn the journey into a case.', '把旅程变成案例。')}</h3>
                <p>{l('Upload at least two outcome files, add your learning, then choose when to share.', '至少上传两份成果文件，写下收获，然后决定何时分享。')}</p>
              </div>
            </div>
            <Field label={l('Conclusions and outcomes', '结论与成果')} hint={l('One conclusion per line', '每行一条结论')}>
              <textarea rows={5} value={draft.fields.outcomeSummary} onChange={(event) => updateField('outcomeSummary', event.target.value)} />
            </Field>
            <Field label={l('Project Learning & Value', '项目收获与价值')}>
              <textarea rows={5} value={draft.fields.reflection} onChange={(event) => updateField('reflection', event.target.value)} placeholder={l('What did the team learn, and what is the value of this project?', '小队学到了什么？这个项目有什么价值？')} />
            </Field>
            <Field label={l('Questions still open', '仍待探索的问题')} hint={l('One question per line', '每行一个问题')}>
              <textarea rows={3} value={draft.fields.openQuestions} onChange={(event) => updateField('openQuestions', event.target.value)} />
            </Field>
            <div className="studio-upload">
              <div>
                <h4>{l('Outcome files', '成果文件')}</h4>
                <p>
                  {l(
                    `${outcomeFiles.length} of 2 required files added · images, PDF, DOC or DOCX`,
                    `已添加 ${outcomeFiles.length}/2 份必需文件 · 图片、PDF、DOC 或 DOCX`,
                  )}
                </p>
              </div>
              <label className="btn btn-secondary">{l('Add outcome file', '添加成果文件')}<input type="file" hidden disabled={busy} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.avif" onChange={(event) => upload(event, 'outcomes')} /></label>
            </div>
            <FileList files={files} kind="outcomes" busy={busy} onDelete={removeFile} />
            <label className="studio-share">
              <input type="checkbox" checked={draft.shareWithLibrary} onChange={(event) => setDraft((current) => ({ ...current, shareWithLibrary: event.target.checked }))} />
              <span>
                <strong>{l('Share with the public Case Library', '分享到公开案例库')}</strong>
                <small>{l('Only the public case, submitted journals and eligible photos/outcomes are visible. Member names and proposal files stay private.', '仅公开案例、已提交的日志与符合条件的照片/成果会展示，成员姓名与方案文件保持私密。')}</small>
              </span>
            </label>
            {project?.published ? (
              <div className="studio-published">
                <div>
                  <strong>{l('Your case is live.', '你的案例已上线。')}</strong>
                  <span>{l('Last saved', '最近保存')} {new Date(project.updatedAt).toLocaleString()}</span>
                </div>
                <Link className="btn btn-primary" to={`/cases/${project.id}`}>{l('Open published case', '打开已发布案例')} <Icon name="arrow" size={15} /></Link>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={unpublish}>{l('Make private', '转为私密')}</button>
              </div>
            ) : (
              <>
                {!journalComplete || outcomeFiles.length < 2 ? (
                  <ul className="studio-publish-check" aria-label={l('Publishing requirements', '发布条件')}>
                    <li className={journalComplete ? 'is-done' : ''}>
                      <Icon name={journalComplete ? 'check' : 'note'} size={14} />
                      <span>
                        {journalComplete
                          ? l(`${submittedJournals} journal${submittedJournals === 1 ? '' : 's'} submitted`, `已提交 ${submittedJournals} 篇日志`)
                          : l('Submit at least one day journal in step 3 first.', '请先在第三步提交至少一天的日志。')}
                      </span>
                      {journalComplete ? null : (
                        <button type="button" className="text-btn" onClick={() => goToStage(2)}>{l('Go to journal', '前往日志')}</button>
                      )}
                    </li>
                    <li className={outcomeFiles.length >= 2 ? 'is-done' : ''}>
                      <Icon name={outcomeFiles.length >= 2 ? 'check' : 'note'} size={14} />
                      <span>
                        {l(
                          `${outcomeFiles.length} of 2 outcome files added${outcomeFiles.length < 2 ? ` · add ${2 - outcomeFiles.length} more` : ''}`,
                          `已添加 ${outcomeFiles.length}/2 份成果文件${outcomeFiles.length < 2 ? ` · 还需 ${2 - outcomeFiles.length} 份` : ''}`,
                        )}
                      </span>
                    </li>
                  </ul>
                ) : null}
                <button type="button" className="btn btn-primary studio-panel-submit" disabled={busy || outcomeFiles.length < 2 || !journalComplete} onClick={() => submitStage(3)}>{l('Publish complete case', '发布完整案例')} <Icon name="arrow" size={15} /></button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="studio-savebar">
        <span>
          <Icon name={project ? 'check' : 'note'} size={15} />{' '}
          {project ? l(`Cloud version ${project.version}`, `云端版本 ${project.version}`) : l('No cloud draft yet', '暂无云端草稿')}
        </span>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save()}>{busy ? l('Saving…', '保存中…') : l('Save cloud draft', '保存云端草稿')}</button>
      </div>

      <div className="studio-mobilebar">
        <div className="studio-mobilebar-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save()}>
            {busy ? l('Saving…', '保存中…') : l('Save draft', '保存草稿')}
          </button>
          {project?.published && stage === 3 ? null : (
            <button type="button" className="btn btn-primary" disabled={busy || !canSubmit} onClick={submitCurrent}>
              {stage === 3 ? l('Submit & publish', '提交并发布') : l('Submit', '提交')}
            </button>
          )}
        </div>
        <div className="studio-mobilebar-nav">
          <button type="button" disabled={stage === 0} onClick={() => goToStage(stage - 1)}>← {l('Back', '上一步')}</button>
          <span>{stage + 1} / {STAGES.length}</span>
          <button type="button" disabled={stage === STAGES.length - 1} onClick={() => goToStage(stage + 1)}>{l('Next', '下一步')} →</button>
        </div>
        <p className="studio-mobilebar-meta">
          {stage === 3 && !project?.published && (outcomeFiles.length < 2 || !journalComplete)
            ? [
                journalComplete ? null : l('submit a journal', '需先提交日志'),
                outcomeFiles.length < 2 ? l(`add ${2 - outcomeFiles.length} more outcome file${outcomeFiles.length === 1 ? '' : 's'}`, `还需 ${2 - outcomeFiles.length} 份成果文件`) : null,
              ].filter(Boolean).join(' · ')
            : project ? l(`Cloud version ${project.version}`, `云端版本 ${project.version}`) : l('No cloud draft yet', '暂无云端草稿')}
        </p>
      </div>
    </section>
  )
}
