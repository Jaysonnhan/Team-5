import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'data')
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DIST_DIR = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT) || 8787
const SESSION_COOKIE = 'dj_session'
const SESSION_SECONDS = 60 * 60 * 24 * 30
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)
const TEXT_FIELDS = [
  'title', 'destination', 'question', 'specifics', 'team', 'members', 'summary',
  'themes', 'methods', 'proposalNote', 'outcomeSummary', 'reflection', 'openQuestions',
]
const JOURNAL_FIELDS = ['observations', 'challenges', 'response', 'photoNote']

mkdirSync(UPLOAD_DIR, { recursive: true })
const db = new DatabaseSync(path.join(DATA_DIR, 'dream-journey.sqlite'))
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    document TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    published INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS projects_public ON projects(published, updated_at);
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    day INTEGER,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    object_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS files_project ON files(project_id);
`)
if (!db.prepare('PRAGMA table_info(users)').all().some((column) => column.name === 'role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")
}

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

function json(res, data, status = 200, headers = {}) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(body)
}

async function readBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new ApiError('Request is too large.', 413)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(req, limit = 256 * 1024) {
  const raw = await readBody(req, limit)
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    throw new ApiError('Invalid JSON request.')
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
      const index = item.indexOf('=')
      return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))]
    }),
  )
}

function cookieHeader(req, token, maxAge = SESSION_SECONDS) {
  const forwarded = req.headers['x-forwarded-proto'] === 'https'
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${forwarded ? '; Secure' : ''}`
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hashPassword(password, salt) {
  return scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex')
}

function safeEqual(left, right) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  db.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at) VALUES (?,?,?,?)').run(
    digest(token),
    userId,
    now.toISOString(),
    new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString(),
  )
  return token
}

function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (!token) return null
  const id = digest(token)
  const user = db.prepare(`
    SELECT users.id, users.email, users.role, sessions.id AS session_id, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
  `).get(id)
  if (!user) return null
  if (new Date(user.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return null
  }
  return user
}

function isAdministrator(user) {
  return Boolean(user) && (user.role === 'admin' || ADMIN_EMAILS.includes(user.email))
}

function userDto(user) {
  return { id: user.id, email: user.email, administrator: isAdministrator(user) }
}

function credentials(body) {
  const email = String(body?.email || '').trim().toLowerCase()
  const password = String(body?.password || '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ApiError('Enter a valid email address.')
  if (password.length < 10 || password.length > 128) throw new ApiError('Password must contain between 10 and 128 characters.')
  return { email, password }
}

function emptyDocument() {
  return {
    fields: Object.fromEntries(TEXT_FIELDS.map((key) => [key, ''])),
    days: 3,
    selectedDay: 1,
    journals: {},
    submitted: [false, false, false, false],
    shareWithLibrary: false,
  }
}

function text(value) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string' || value.length > 12000) throw new ApiError('Each text field must contain at most 12,000 characters.')
  return value
}

function normalizeDocument(input) {
  if (!input || typeof input !== 'object' || !input.fields || !input.journals) throw new ApiError('Invalid project document.')
  const days = Number(input.days)
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new ApiError('Trip duration must be between 1 and 30 days.')
  const selectedDay = Number(input.selectedDay) || 1
  if (!Number.isInteger(selectedDay)) throw new ApiError('Invalid selected journal day.')
  const output = {
    fields: {},
    days,
    selectedDay: Math.min(days, Math.max(1, selectedDay)),
    journals: {},
    submitted: [false, false, false, false],
    shareWithLibrary: input.shareWithLibrary === true,
  }
  for (const key of TEXT_FIELDS) output.fields[key] = text(input.fields[key])
  for (const [day, journal] of Object.entries(input.journals)) {
    if (!/^\d+$/.test(day) || Number(day) < 1 || Number(day) > days) throw new ApiError('Invalid journal day.')
    const normalized = { submitted: journal?.submitted === true }
    for (const key of JOURNAL_FIELDS) normalized[key] = text(journal?.[key])
    if (normalized.submitted && !normalized.observations.trim()) throw new ApiError('A submitted journal needs daily discoveries.')
    output.journals[day] = normalized
  }
  if (!Array.isArray(input.submitted) || input.submitted.length !== 4) throw new ApiError('Invalid submission status.')
  output.submitted = input.submitted.map((value) => value === true)
  if (output.submitted[0]) {
    const required = ['title', 'destination', 'question', 'team', 'members', 'summary', 'themes']
    if (required.some((key) => !output.fields[key].trim())) throw new ApiError('Complete the required idea fields before submitting.')
  }
  if (output.submitted[1] && !output.fields.methods.trim()) throw new ApiError('Add research methods before submitting the proposal.')
  if (output.submitted[3]) {
    if (!output.fields.outcomeSummary.trim() || !output.fields.reflection.trim()) throw new ApiError('Add outcomes and a reflection before publishing.')
    if (!Object.values(output.journals).some((journal) => journal.submitted)) throw new ApiError('Submit at least one field journal before publishing.')
  }
  return output
}

function projectDto(row) {
  return {
    id: row.id,
    document: JSON.parse(row.document),
    version: row.version,
    published: row.published === 1,
    updatedAt: row.updated_at,
  }
}

function fileDto(file, publicFile = false) {
  return {
    id: file.id,
    kind: file.kind,
    day: file.day,
    name: publicFile ? `${file.kind === 'photos' ? 'Field photo' : 'Project file'} ${file.id.slice(0, 6)}` : file.name,
    type: file.type,
    size: file.size,
    url: `/api/v1/${publicFile ? 'case-files' : 'files'}/${file.id}`,
    createdAt: file.created_at,
  }
}

function ownProject(userId) {
  return db.prepare('SELECT * FROM projects WHERE owner_id = ?').get(userId)
}

function projectFiles(projectId) {
  return db.prepare('SELECT * FROM files WHERE project_id = ? ORDER BY created_at, id').all(projectId)
}

const PREVIEW_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])

function adminFileDto(file) {
  return {
    id: file.id,
    kind: file.kind,
    day: file.day,
    name: file.name,
    type: file.type,
    size: file.size,
    url: `/api/v1/admin/files/${file.id}`,
    previewUrl: PREVIEW_TYPES.has(file.type) ? `/api/v1/admin/files/${file.id}?preview=1` : '',
    createdAt: file.created_at,
  }
}

function adminSummary(row) {
  const document = JSON.parse(row.document)
  return {
    id: row.id,
    team: document.fields.team || 'Untitled team',
    destination: document.fields.destination || '',
    question: document.fields.question || '',
    days: document.days,
    submitted: document.submitted,
    journalSubmitted: Object.entries(document.journals).filter(([day, journal]) => Number(day) <= document.days && journal.submitted).length,
    fileCount: Number(row.file_count) || 0,
    published: row.published === 1,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function adminOverview() {
  const projects = db.prepare(`
    SELECT COUNT(*) AS totalProjects,
      COALESCE(SUM(CASE WHEN json_extract(document, '$.submitted[3]') = 1 THEN 1 ELSE 0 END), 0) AS finalSubmissions,
      COALESCE(SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END), 0) AS publishedProjects
    FROM projects
  `).get()
  const files = db.prepare('SELECT COUNT(*) AS totalFiles, COALESCE(SUM(size), 0) AS storageBytes FROM files').get()
  const journals = db.prepare(`
    SELECT COUNT(*) AS submittedJournals FROM projects, json_each(projects.document, '$.journals') AS journal
    WHERE CAST(journal.key AS INTEGER) <= json_extract(projects.document, '$.days')
      AND json_extract(journal.value, '$.submitted') = 1
  `).get()
  return { ...projects, ...files, ...journals }
}

function adminProjects(url) {
  const query = (url.searchParams.get('q') || '').trim().slice(0, 200)
  const status = url.searchParams.get('status') || 'all'
  if (!['all', 'final', 'in-progress', 'no-files'].includes(status)) throw new ApiError('Invalid status filter.')
  const limit = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get('limit')) || 25)))
  const offset = Math.max(0, Math.min(10000, Math.floor(Number(url.searchParams.get('offset')) || 0)))
  const where = `
    (? = '' OR instr(lower(
      COALESCE(json_extract(p.document, '$.fields.team'), '') || ' ' ||
      COALESCE(json_extract(p.document, '$.fields.destination'), '') || ' ' ||
      COALESCE(json_extract(p.document, '$.fields.question'), '')
    ), lower(?)) > 0)
    AND (? = 'all'
      OR (? = 'final' AND json_extract(p.document, '$.submitted[3]') = 1)
      OR (? = 'in-progress' AND json_extract(p.document, '$.submitted[3]') != 1)
      OR (? = 'no-files' AND NOT EXISTS (SELECT 1 FROM files f WHERE f.project_id = p.id)))
  `
  const binds = [query, query, status, status, status, status]
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM projects p WHERE ${where}`).get(...binds)
  const rows = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM files f WHERE f.project_id = p.id) AS file_count
    FROM projects p WHERE ${where}
    ORDER BY p.updated_at DESC, p.id LIMIT ? OFFSET ?
  `).all(...binds, limit, offset)
  return { projects: rows.map(adminSummary), total, limit, offset, hasMore: offset + rows.length < total }
}

function lines(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

function publicCase(row, files) {
  const document = JSON.parse(row.document)
  const fields = document.fields
  const publicFiles = files
    .filter((file) => file.kind === 'outcomes' || (file.kind === 'photos' && document.journals[file.day]?.submitted))
    .map((file) => fileDto(file, true))
  const outcomeFiles = publicFiles.filter((file) => file.kind === 'outcomes')
  const journals = Object.entries(document.journals)
    .filter(([day, journal]) => Number(day) <= document.days && journal.submitted)
    .sort(([a], [b]) => Number(a) - Number(b))
  const journey = []
  if (fields.proposalNote.trim()) {
    journey.push({ id: `${row.id}-proposal`, phase: 'Preparation · Research proposal', title: 'Planning the field study', description: fields.proposalNote })
  }
  for (const [day, journal] of journals) {
    journey.push({
      id: `${row.id}-day-${day}`,
      phase: `Fieldwork · Day ${day}`,
      title: `Day ${day} field journal`,
      description: [journal.observations, journal.challenges && `Challenges: ${journal.challenges}`, journal.response && `What the team changed: ${journal.response}`, journal.photoNote && `Photo note: ${journal.photoNote}`].filter(Boolean).join('\n\n'),
    })
  }
  const entries = journals.map(([day, journal]) => {
    const photo = publicFiles.find((file) => file.kind === 'photos' && file.day === Number(day))
    return {
      id: `${row.id}-entry-${day}`,
      caseId: row.id,
      kind: 'observation',
      text: [journal.observations, journal.challenges && `Challenge: ${journal.challenges}`, journal.response && `Response: ${journal.response}`].filter(Boolean).join('\n\n'),
      photoUrl: photo?.url || '',
      photoName: photo ? `Day ${day} field photo` : '',
      visibility: 'public',
      createdAt: row.updated_at,
    }
  })
  const images = publicFiles.filter((file) => /^image\/(png|jpeg|webp|gif)$/i.test(file.type))
  const questions = [{ topic: 'Main question', text: fields.question }]
  for (const question of lines(fields.specifics)) questions.push({ topic: 'Follow-up question', text: question })
  return {
    id: row.id,
    title: fields.title,
    titleEn: fields.title,
    coverImage: images[0]?.url || '',
    status: 'published',
    themes: fields.themes.split(',').map((theme) => theme.trim()).filter(Boolean),
    subjects: [],
    keywords: [],
    meta: {
      program: 'Go Far field study · Adream Foundation',
      location: fields.destination,
      team: fields.team,
      period: `Updated ${new Date(row.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    },
    source: {
      kind: 'student_submission',
      provenance: 'Created and published through this local Dream Journey workspace. Member names, proposal files, drafts and unsubmitted journals stay private.',
    },
    summary: fields.summary,
    researchQuestions: questions,
    methods: lines(fields.methods),
    journey,
    outcomes: {
      conclusions: lines(fields.outcomeSummary),
      artifacts: outcomeFiles.map((file, index) => `Project outcome ${index + 1}`),
    },
    impactReflection: { summary: fields.reflection, reflections: [], openQuestions: lines(fields.openQuestions) },
    posters: images.map((file, index) => ({
      src: file.url,
      caption: file.kind === 'photos' ? `Field photo from day ${file.day}.` : `Project outcome image ${index + 1}.`,
    })),
    attachments: outcomeFiles.map((file, index) => ({ url: file.url, label: `Open project outcome ${index + 1}`, type: file.type })),
    entries,
    updatedAt: row.updated_at,
  }
}

function validSignature(extension, bytes) {
  const at = (offset) => bytes[offset]
  if (extension === 'jpg' || extension === 'jpeg') return at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff
  if (extension === 'png') return at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47
  if (extension === 'gif') return ['GIF89a', 'GIF87a'].includes(String.fromCharCode(...bytes.slice(0, 6)))
  if (extension === 'webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (extension === 'pdf') return String.fromCharCode(...bytes.slice(0, 4)) === '%PDF'
  if (extension === 'docx') return at(0) === 0x50 && at(1) === 0x4b
  if (extension === 'doc') return at(0) === 0xd0 && at(1) === 0xcf && at(2) === 0x11 && at(3) === 0xe0
  if (['heic', 'heif', 'avif'].includes(extension)) return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp'
  return false
}

function saveProject(user, body) {
  const document = normalizeDocument(body.document)
  const version = Number(body.version)
  if (!Number.isInteger(version) || version < 0) throw new ApiError('A valid version is required.')
  const row = ownProject(user.id)
  const counts = row ? db.prepare('SELECT kind, COUNT(*) AS count FROM files WHERE project_id = ? GROUP BY kind').all(row.id) : []
  if (document.submitted[1] && !counts.some((item) => item.kind === 'proposal' && item.count >= 1)) throw new ApiError('Upload a proposal before submitting.')
  if (document.submitted[3] && !counts.some((item) => item.kind === 'outcomes' && item.count >= 2)) throw new ApiError('Upload at least two outcome files before publishing.')
  const published = document.shareWithLibrary && document.submitted[3] ? 1 : 0
  const now = new Date().toISOString()
  const id = row?.id || randomUUID()
  if (row) {
    if (row.version !== version) throw new ApiError('A newer local version exists. Reload before saving.', 409)
    const result = db.prepare('UPDATE projects SET document=?, version=version+1, published=?, updated_at=? WHERE id=? AND version=?')
      .run(JSON.stringify(document), published, now, row.id, version)
    if (!result.changes) throw new ApiError('A newer local version exists. Reload before saving.', 409)
  } else {
    if (version !== 0) throw new ApiError('Project not found. Reload before saving.', 409)
    try {
      db.prepare('INSERT INTO projects (id,owner_id,document,version,published,created_at,updated_at) VALUES (?,?,?,1,?,?,?)')
        .run(id, user.id, JSON.stringify(document), published, now, now)
    } catch {
      if (ownProject(user.id)) throw new ApiError('A project already exists. Reload before saving.', 409)
      throw new Error('Could not create the project.')
    }
  }
  return { project: { id, document, version: version + 1, published: published === 1, updatedAt: now } }
}

async function uploadFile(user, body) {
  const row = ownProject(user.id)
  if (!row) throw new ApiError('Save your project before adding files.', 409)
  const version = Number(body.version)
  if (!Number.isInteger(version) || version !== row.version) throw new ApiError('Reload the local project before uploading.', 409)
  const kind = String(body.kind || '')
  if (!['photos', 'proposal', 'outcomes'].includes(kind)) throw new ApiError('Select a valid upload category.')
  const name = String(body.name || '').replace(/[\r\n\x00-\x1f]/g, '').slice(0, 200)
  const extension = name.split('.').pop()?.toLowerCase() || ''
  const allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'avif', 'pdf', 'doc', 'docx']
  if (!allowed.includes(extension) || (kind === 'photos' && ['pdf', 'doc', 'docx'].includes(extension))) throw new ApiError('Unsupported file type.')
  const buffer = Buffer.from(String(body.data || ''), 'base64')
  if (!buffer.length || buffer.length > 15 * 1024 * 1024) throw new ApiError('Files must be non-empty and no larger than 15 MB.', 413)
  if (!validSignature(extension, buffer.subarray(0, 16))) throw new ApiError('The file contents do not match its file type.')
  const document = JSON.parse(row.document)
  const day = kind === 'photos' ? Number(body.day) : null
  if (kind === 'photos' && (!Number.isInteger(day) || day < 1 || day > document.days)) throw new ApiError('Invalid trip day.')
  if (kind === 'photos' && document.journals[day]) document.journals[day].submitted = false
  if (kind === 'proposal') document.submitted[1] = false
  if (kind === 'outcomes') document.submitted[3] = false
  const id = randomUUID()
  const key = `${row.id}/${id}`
  const destination = path.join(UPLOAD_DIR, row.id, id)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.writeFile(destination, buffer)
  const type = String(body.type || '')
  const storedType = type.startsWith('image/') || type === 'application/pdf' ? type : 'application/octet-stream'
  const now = new Date().toISOString()
  try {
    db.exec('BEGIN IMMEDIATE')
    db.prepare('INSERT INTO files (id,project_id,kind,day,name,type,size,object_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, row.id, kind, day, name, storedType, buffer.length, key, now)
    const result = db.prepare('UPDATE projects SET document=?, version=version+1, published=0, updated_at=? WHERE id=? AND version=?')
      .run(JSON.stringify(document), now, row.id, version)
    if (!result.changes) throw new ApiError('A newer local version exists. Reload before uploading.', 409)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    await fs.unlink(destination).catch(() => {})
    throw error
  }
  const file = { id, kind, day, name, type: storedType, size: buffer.length, created_at: now }
  return { file: fileDto(file), project: { id: row.id, document, version: version + 1, published: false, updatedAt: now } }
}

async function deleteFile(user, fileId, body) {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId)
  if (!file) throw new ApiError('File not found.', 404)
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND owner_id = ?').get(file.project_id, user.id)
  if (!row) throw new ApiError('File not found.', 404)
  const version = Number(body.version)
  if (!Number.isInteger(version) || version !== row.version) throw new ApiError('Reload the local project before deleting files.', 409)
  const document = JSON.parse(row.document)
  if (file.kind === 'photos' && document.journals[file.day]) document.journals[file.day].submitted = false
  if (file.kind === 'proposal') document.submitted[1] = false
  if (file.kind === 'outcomes') document.submitted[3] = false
  const now = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare('DELETE FROM files WHERE id = ?').run(file.id)
    const result = db.prepare('UPDATE projects SET document=?, version=version+1, published=0, updated_at=? WHERE id=? AND version=?')
      .run(JSON.stringify(document), now, row.id, version)
    if (!result.changes) throw new ApiError('A newer local version exists. Reload before deleting.', 409)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  await fs.unlink(path.join(UPLOAD_DIR, file.object_key)).catch(() => {})
  return { deleted: true, project: { id: row.id, document, version: version + 1, published: false, updatedAt: now } }
}

function sendStoredFile(res, file, { publicFile = false, preview = false } = {}) {
  const location = path.join(UPLOAD_DIR, file.object_key)
  if (!existsSync(location)) return json(res, { error: 'File not found.' }, 404)
  const inline = preview || file.type.startsWith('image/') || file.type === 'application/pdf'
  res.writeHead(200, {
    'Content-Type': file.type,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': publicFile ? 'no-store' : 'private, no-store',
  })
  createReadStream(location).pipe(res)
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const parts = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean)
  const method = req.method
  if (method === 'GET' && parts[0] === 'health') return json(res, { ok: true, apiVersion: 'v1', storage: 'Local SQLite + files' })
  if (!['GET', 'HEAD'].includes(method)) {
    const origin = req.headers.origin
    const allowed = new Set([
      `http://${req.headers.host}`,
      `https://${req.headers.host}`,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ])
    if (origin && !allowed.has(origin)) throw new ApiError('Cross-origin writes are not allowed.', 403)
  }
  if (method === 'POST' && parts[0] === 'auth' && ['register', 'login'].includes(parts[1])) {
    const { email, password } = credentials(await readJson(req))
    if (parts[1] === 'register') {
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw new ApiError('An account already exists for this email.', 409)
      const salt = randomBytes(16).toString('hex')
      const userId = randomUUID()
      const role = db.prepare('SELECT COUNT(*) AS total FROM users').get().total === 0 ? 'admin' : 'student'
      db.prepare('INSERT INTO users (id,email,password_hash,password_salt,role,created_at) VALUES (?,?,?,?,?,?)')
        .run(userId, email, hashPassword(password, salt), salt, role, new Date().toISOString())
      const token = createSession(userId)
      return json(res, { user: userDto({ id: userId, email, role }) }, 201, { 'Set-Cookie': cookieHeader(req, token) })
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user || !safeEqual(hashPassword(password, user.password_salt), user.password_hash)) throw new ApiError('Email or password is incorrect.', 401)
    const token = createSession(user.id)
    return json(res, { user: userDto(user) }, 200, { 'Set-Cookie': cookieHeader(req, token) })
  }
  if (method === 'POST' && parts[0] === 'auth' && parts[1] === 'logout') {
    const user = currentUser(req)
    if (user) db.prepare('DELETE FROM sessions WHERE id = ?').run(user.session_id)
    return json(res, { signedOut: true }, 200, { 'Set-Cookie': cookieHeader(req, '', 0) })
  }
  if (method === 'GET' && parts[0] === 'session') {
    const user = currentUser(req)
    return json(res, { authenticated: Boolean(user), administrator: isAdministrator(user), user: user ? userDto(user) : null })
  }
  if (method === 'GET' && parts[0] === 'cases') {
    if (parts[1]) {
      const row = db.prepare('SELECT * FROM projects WHERE id = ? AND published = 1').get(parts[1])
      if (!row) throw new ApiError('Case not found.', 404)
      return json(res, { case: publicCase(row, projectFiles(row.id)) })
    }
    const rows = db.prepare('SELECT * FROM projects WHERE published = 1 ORDER BY updated_at DESC, id').all()
    return json(res, { cases: rows.map((row) => publicCase(row, projectFiles(row.id))) })
  }
  if (method === 'GET' && parts[0] === 'case-files' && parts[1]) {
    const file = db.prepare(`
      SELECT files.*, projects.document FROM files
      JOIN projects ON files.project_id = projects.id
      WHERE files.id = ? AND projects.published = 1 AND files.kind IN ('photos','outcomes')
    `).get(parts[1])
    if (!file) throw new ApiError('File not found.', 404)
    const document = JSON.parse(file.document)
    if (file.kind === 'photos' && (file.day > document.days || !document.journals[file.day]?.submitted)) throw new ApiError('File not found.', 404)
    return sendStoredFile(res, file, { publicFile: true })
  }
  const user = currentUser(req)
  if (!user) throw new ApiError('Sign in to access your student project.', 401)
  if (parts[0] === 'admin') {
    if (!isAdministrator(user)) throw new ApiError('This account does not have administrator access.', 403)
    if (method !== 'GET') throw new ApiError('The administrator console is read-only.', 405)
    if (parts[1] === 'overview' && parts.length === 2) return json(res, { metrics: adminOverview() })
    if (parts[1] === 'projects' && parts.length === 2) return json(res, adminProjects(url))
    if (parts[1] === 'projects' && parts.length === 3) {
      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(parts[2])
      if (!row) throw new ApiError('Project not found.', 404)
      return json(res, { project: { ...projectDto(row), createdAt: row.created_at }, files: projectFiles(row.id).map(adminFileDto) })
    }
    if (parts[1] === 'files' && parts.length === 3) {
      const file = db.prepare('SELECT * FROM files WHERE id = ?').get(parts[2])
      if (!file) throw new ApiError('File not found.', 404)
      const preview = url.searchParams.get('preview') === '1' && PREVIEW_TYPES.has(file.type)
      return sendStoredFile(res, file, { preview })
    }
    throw new ApiError('Administrator endpoint not found.', 404)
  }
  if (parts[0] === 'project' && parts.length === 1) {
    if (method === 'GET') {
      const row = ownProject(user.id)
      return json(res, { project: row ? projectDto(row) : null, emptyDocument: row ? undefined : emptyDocument() })
    }
    if (method === 'PUT') return json(res, saveProject(user, await readJson(req)))
  }
  if (parts[0] === 'files') {
    if (parts.length === 1 && method === 'GET') {
      const row = ownProject(user.id)
      return json(res, { files: row ? projectFiles(row.id).map((file) => fileDto(file)) : [] })
    }
    if (parts.length === 1 && method === 'POST') return json(res, await uploadFile(user, await readJson(req, 22 * 1024 * 1024)), 201)
    if (parts.length === 2 && method === 'GET') {
      const file = db.prepare('SELECT files.* FROM files JOIN projects ON files.project_id = projects.id WHERE files.id = ? AND projects.owner_id = ?').get(parts[1], user.id)
      if (!file) throw new ApiError('File not found.', 404)
      return sendStoredFile(res, file)
    }    if (parts.length === 2 && method === 'DELETE') return json(res, await deleteFile(user, parts[1], await readJson(req)))
  }
  throw new ApiError('Endpoint not found.', 404)
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

async function serveStatic(req, res) {
  if (!existsSync(DIST_DIR)) {
    return json(res, { message: 'Run npm run dev for the frontend, or npm run build before npm start.' }, 404)
  }
  const url = new URL(req.url, 'http://localhost')
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const location = path.resolve(DIST_DIR, `.${requested}`)
  const safe = location.startsWith(`${DIST_DIR}${path.sep}`) && existsSync(location) && (await fs.stat(location)).isFile()
  const file = safe ? location : path.join(DIST_DIR, 'index.html')
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  })
  createReadStream(file).pipe(res)
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/v1')) return await handleApi(req, res)
    return await serveStatic(req, res)
  } catch (error) {
    if (res.headersSent) return res.end()
    if (error instanceof ApiError) return json(res, { error: error.message }, error.status)
    console.error('Local API failure', error)
    return json(res, { error: 'The request could not be completed. Please try again.' }, 500)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Dream Journey local server: http://localhost:${PORT}`)
})
