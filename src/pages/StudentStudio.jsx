import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAppState } from '../lib/AppState.jsx'
import Icon from '../components/Icon.jsx'

const STAGES = ['Idea', 'Proposal', 'Journal', 'Outcomes']
const EMPTY_JOURNAL = { observations: '', challenges: '', response: '', photoNote: '', submitted: false }

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
  if (!visible.length) return <p className="studio-empty">No files added yet.</p>
  return (
    <ul className="studio-files">
      {visible.map((file) => (
        <li key={file.id}>
          <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a>
          <span>{Math.max(1, Math.round(file.size / 1024))} KB</span>
          <button type="button" className="text-btn danger" disabled={busy} onClick={() => onDelete(file)}>Remove</button>
        </li>
      ))}
    </ul>
  )
}

export default function StudentStudio() {
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

  async function save(nextDraft = draft, message = 'Cloud draft saved.') {
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
      setError(saveError.status === 409 ? `${saveError.message} Your current text is still on this screen.` : saveError.message)
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
    const saved = await save({ ...draft, submitted, shareWithLibrary: index === 3 ? true : draft.shareWithLibrary }, index === 3 ? 'Your case is now live in the public library.' : `${STAGES[index]} submitted.`)
    if (saved && index < 3) setStage(index + 1)
  }

  async function submitJournal() {
    const day = draft.selectedDay
    const journal = { ...EMPTY_JOURNAL, ...draft.journals[day], submitted: true }
    const submitted = [...draft.submitted]
    submitted[2] = true
    await save({ ...draft, journals: { ...draft.journals, [day]: journal }, submitted }, `Day ${day} journal submitted.`)
  }

  async function upload(event, kind) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const saved = await save(draft, 'Draft saved. Uploading file…')
    if (!saved) return
    setBusy(true)
    setError('')
    try {
      const result = await api.uploadFile(file, kind, draft.selectedDay, saved.version)
      applyProject(result.project)
      setFiles((current) => [...current, result.file])
      setNotice('File uploaded. Resubmit this stage before publishing again.')
      if (saved.published) await refreshCases()
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeFile(file) {
    if (!window.confirm(`Remove ${file.name}? This will also withdraw the affected submission.`)) return
    setBusy(true)
    setError('')
    try {
      const result = await api.deleteFile(file.id, project.version)
      applyProject(result.project)
      setFiles((current) => current.filter((item) => item.id !== file.id))
      setNotice('File removed. The affected stage needs to be submitted again.')
      if (project.published) await refreshCases()
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusy(false)
    }
  }

  async function unpublish() {
    await save({ ...draft, shareWithLibrary: false }, 'The case is private again. Your cloud draft is unchanged.')
  }

  if (status === 'loading') {
    return <section className="student-studio studio-state" id="studio"><p>Loading your student studio…</p></section>
  }

  if (status === 'error') {
    return (
      <section className="student-studio studio-state" id="studio">
        <h2>Student studio unavailable</h2>
        <p>{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => { setStatus('loading'); loadWorkspace().catch((loadError) => { setError(loadError.message); setStatus('error') }) }}>Try again</button>
      </section>
    )
  }

  if (status === 'signedOut') {
    return (
      <section className="student-studio" id="studio">
        <div className="studio-auth-copy">
          <p className="eyebrow">02 / YOUR FIELD STUDY</p>
          <h2 className="page-title">Keep every discovery.</h2>
          <p className="page-lede">Create one account for your team to save a cloud draft, upload field files and publish a complete case.</p>
          <ul className="studio-benefits">
            <li><Icon name="check" size={16} /> Continue on another device</li>
            <li><Icon name="check" size={16} /> Keep drafts and member names private</li>
            <li><Icon name="check" size={16} /> Share only when your outcomes are ready</li>
          </ul>
        </div>
        <form className="studio-auth" onSubmit={authenticate}>
          <div className="segmented-control" role="group" aria-label="Account action">
            <button type="button" className={authMode === 'login' ? 'is-on' : ''} onClick={() => setAuthMode('login')}>Sign in</button>
            <button type="button" className={authMode === 'register' ? 'is-on' : ''} onClick={() => setAuthMode('register')}>Create account</button>
          </div>
          <Field label="Team email">
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="team@example.com" />
          </Field>
          <Field label="Password" hint="At least 10 characters">
            <input type="password" required minLength={10} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error ? <p className="studio-message is-error" role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : authMode === 'register' ? 'Create account & continue' : 'Sign in & continue'}</button>
          <p className="studio-privacy"><Icon name="lock" size={14} /> Passwords are salted and hashed. Sessions use secure, HTTP-only cookies.</p>
        </form>
      </section>
    )
  }

  if (!draft) return null
  const journal = { ...EMPTY_JOURNAL, ...draft.journals[draft.selectedDay] }
  const proposalFiles = files.filter((file) => file.kind === 'proposal')
  const outcomeFiles = files.filter((file) => file.kind === 'outcomes')
  const journalComplete = Object.values(draft.journals).some((item) => item.submitted)
  const complete = [draft.submitted[0], draft.submitted[1], journalComplete, draft.submitted[3]]

  return (
    <section className="student-studio student-studio-signed-in" id="studio">
      <div className="studio-heading">
        <div>
          <p className="eyebrow">02 / YOUR FIELD STUDY</p>
          <h2 className="page-title">From first question to shared story.</h2>
          <p className="page-lede">Signed in as {user.email}. Save each stage as a cloud draft, then submit it when ready.</p>
        </div>
        <div className="studio-heading-actions">
          {user.administrator ? <Link className="btn btn-secondary" to="/admin"><Icon name="eye" size={15} /> Program console</Link> : null}
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={signOut}>Sign out</button>
        </div>
      </div>

      <nav className="studio-stages" aria-label="Project stages">
        {STAGES.map((label, index) => (
          <button type="button" key={label} className={`${stage === index ? 'is-current' : ''} ${complete[index] ? 'is-complete' : ''}`} onClick={() => setStage(index)}>
            <span>{complete[index] ? <Icon name="check" size={15} /> : index + 1}</span>
            <strong>{label}</strong>
            <small>{complete[index] ? 'Submitted' : 'In progress'}</small>
          </button>
        ))}
      </nav>

      {error ? (
        <div className="studio-message is-error" role="alert">
          <span>{error}</span>
          {error.includes('newer') || error.includes('Reload') ? <button type="button" className="text-btn" onClick={loadWorkspace}>Reload cloud version</button> : null}
        </div>
      ) : null}
      {notice ? <p className="studio-message is-success" role="status">{notice}</p> : null}

      <div className="studio-editor">
        {stage === 0 ? (
          <div className="studio-form">
            <div className="studio-form-heading"><span>01</span><div><h3>Start with a real question.</h3><p>Team members stay private and never appear in the public case.</p></div></div>
            <Field label="Project title"><input value={draft.fields.title} onChange={(event) => updateField('title', event.target.value)} placeholder="What is your field study called?" /></Field>
            <div className="studio-two-col">
              <Field label="Team name"><input value={draft.fields.team} onChange={(event) => updateField('team', event.target.value)} /></Field>
              <Field label="Destination"><input value={draft.fields.destination} onChange={(event) => updateField('destination', event.target.value)} /></Field>
            </div>
            <Field label="Team members" hint="Private — used only for team accountability"><input value={draft.fields.members} onChange={(event) => updateField('members', event.target.value)} /></Field>
            <Field label="Project summary"><textarea rows={4} value={draft.fields.summary} onChange={(event) => updateField('summary', event.target.value)} placeholder="What will you explore, and why does it matter to your team?" /></Field>
            <Field label="Themes" hint="Separate themes with commas"><input value={draft.fields.themes} onChange={(event) => updateField('themes', event.target.value)} placeholder="Environment, Community voice, Education" /></Field>
            <Field label="Main research question"><textarea rows={3} value={draft.fields.question} onChange={(event) => updateField('question', event.target.value)} /></Field>
            <Field label="Follow-up questions" hint="One question per line"><textarea rows={4} value={draft.fields.specifics} onChange={(event) => updateField('specifics', event.target.value)} /></Field>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => submitStage(0)}>Submit idea & continue <Icon name="arrow" size={15} /></button>
          </div>
        ) : null}

        {stage === 1 ? (
          <div className="studio-form">
            <div className="studio-form-heading"><span>02</span><div><h3>Make a plan you can follow.</h3><p>Add your methods and a proposal file before submitting this stage.</p></div></div>
            <Field label="Research methods" hint="One method per line"><textarea rows={5} value={draft.fields.methods} onChange={(event) => updateField('methods', event.target.value)} placeholder={'Field observation\nInterviews\nPhoto documentation'} /></Field>
            <Field label="Proposal notes"><textarea rows={6} value={draft.fields.proposalNote} onChange={(event) => updateField('proposalNote', event.target.value)} placeholder="Your route, schedule, roles, equipment and preparation." /></Field>
            <div className="studio-upload">
              <div><h4>Proposal file</h4><p>PDF, DOC, DOCX or image · up to 15 MB</p></div>
              <label className="btn btn-secondary">Add proposal file<input type="file" hidden disabled={busy} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.avif" onChange={(event) => upload(event, 'proposal')} /></label>
            </div>
            <FileList files={files} kind="proposal" busy={busy} onDelete={removeFile} />
            <button type="button" className="btn btn-primary" disabled={busy || !proposalFiles.length} onClick={() => submitStage(1)}>Submit proposal & continue <Icon name="arrow" size={15} /></button>
          </div>
        ) : null}

        {stage === 2 ? (
          <div className="studio-form">
            <div className="studio-form-heading"><span>03</span><div><h3>Record what actually happened.</h3><p>Only journals you submit will be included in a published case.</p></div></div>
            <Field label="Trip duration" hint="1–30 days"><input type="number" min={1} max={30} value={draft.days} onChange={(event) => changeDays(event.target.value)} /></Field>
            <div className="studio-day-tabs" role="group" aria-label="Journal day">
              {Array.from({ length: draft.days }, (_, index) => index + 1).map((day) => (
                <button type="button" key={day} className={draft.selectedDay === day ? 'is-on' : ''} onClick={() => setDraft((current) => ({ ...current, selectedDay: day }))}>
                  Day {day}{draft.journals[day]?.submitted ? <Icon name="check" size={12} /> : null}
                </button>
              ))}
            </div>
            <Field label={`Day ${draft.selectedDay} discoveries`}><textarea rows={5} value={journal.observations} onChange={(event) => updateJournal('observations', event.target.value)} placeholder="What did you see, hear or learn?" /></Field>
            <Field label="Challenges"><textarea rows={3} value={journal.challenges} onChange={(event) => updateJournal('challenges', event.target.value)} /></Field>
            <Field label="What did you change or do next?"><textarea rows={3} value={journal.response} onChange={(event) => updateJournal('response', event.target.value)} /></Field>
            <Field label="Field photo note"><input value={journal.photoNote} onChange={(event) => updateJournal('photoNote', event.target.value)} placeholder="What should a viewer notice in this photo?" /></Field>
            <div className="studio-upload">
              <div><h4>Day {draft.selectedDay} photos</h4><p>PNG, JPEG, WebP, GIF, HEIC or AVIF · up to 15 MB</p></div>
              <label className="btn btn-secondary">Add field photo<input type="file" hidden disabled={busy} accept=".png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.avif" onChange={(event) => upload(event, 'photos')} /></label>
            </div>
            <FileList files={files} kind="photos" day={draft.selectedDay} busy={busy} onDelete={removeFile} />
            <button type="button" className="btn btn-primary" disabled={busy || !journal.observations.trim()} onClick={submitJournal}>Submit day {draft.selectedDay} journal</button>
            <button type="button" className="text-btn studio-next" onClick={() => setStage(3)}>Continue to outcomes <Icon name="arrow" size={14} /></button>
          </div>
        ) : null}

        {stage === 3 ? (
          <div className="studio-form">
            <div className="studio-form-heading"><span>04</span><div><h3>Turn the journey into a case.</h3><p>Upload at least two outcome files, add your learning, then choose when to share.</p></div></div>
            <Field label="Conclusions and outcomes" hint="One conclusion per line"><textarea rows={5} value={draft.fields.outcomeSummary} onChange={(event) => updateField('outcomeSummary', event.target.value)} /></Field>
            <Field label="Project Learning & Value"><textarea rows={5} value={draft.fields.reflection} onChange={(event) => updateField('reflection', event.target.value)} placeholder="What did the team learn, and what is the value of this project?" /></Field>
            <Field label="Questions still open" hint="One question per line"><textarea rows={3} value={draft.fields.openQuestions} onChange={(event) => updateField('openQuestions', event.target.value)} /></Field>
            <div className="studio-upload">
              <div><h4>Outcome files</h4><p>{outcomeFiles.length} of 2 required files added · images, PDF, DOC or DOCX</p></div>
              <label className="btn btn-secondary">Add outcome file<input type="file" hidden disabled={busy} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.avif" onChange={(event) => upload(event, 'outcomes')} /></label>
            </div>
            <FileList files={files} kind="outcomes" busy={busy} onDelete={removeFile} />
            <label className="studio-share"><input type="checkbox" checked={draft.shareWithLibrary} onChange={(event) => setDraft((current) => ({ ...current, shareWithLibrary: event.target.checked }))} /><span><strong>Share with the public Case Library</strong><small>Only the public case, submitted journals and eligible photos/outcomes are visible. Member names and proposal files stay private.</small></span></label>
            {project?.published ? (
              <div className="studio-published">
                <div><strong>Your case is live.</strong><span>Last saved {new Date(project.updatedAt).toLocaleString()}</span></div>
                <Link className="btn btn-primary" to={`/cases/${project.id}`}>Open published case <Icon name="arrow" size={15} /></Link>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={unpublish}>Make private</button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy || outcomeFiles.length < 2 || !journalComplete} onClick={() => submitStage(3)}>Publish complete case <Icon name="arrow" size={15} /></button>
            )}
          </div>
        ) : null}
      </div>

      <div className="studio-savebar">
        <span><Icon name={project ? 'check' : 'note'} size={15} /> {project ? `Cloud version ${project.version}` : 'No cloud draft yet'}</span>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save cloud draft'}</button>
      </div>
    </section>
  )
}
