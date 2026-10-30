async function request(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    const error = new Error(data?.error || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return data
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(new Error('This file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export const api = {
  session: () => request('/session'),
  register: (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getCases: () => request('/cases'),
  getProject: () => request('/project'),
  saveProject: (version, document) => request('/project', {
    method: 'PUT',
    body: JSON.stringify({ version, document }),
  }),
  getFiles: () => request('/files'),
  uploadFile: async (file, kind, day, version) => request('/files', {
    method: 'POST',
    body: JSON.stringify({
      name: file.name,
      type: file.type,
      size: file.size,
      data: await readAsDataUrl(file),
      kind,
      day,
      version,
    }),
  }),
  deleteFile: (id, version) => request(`/files/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ version }),
  }),
  adminOverview: () => request('/admin/overview'),
  adminProjects: ({ query = '', status = 'all', limit = 25, offset = 0 } = {}) => {
    const params = new URLSearchParams({ q: query, status, limit: String(limit), offset: String(offset) })
    return request(`/admin/projects?${params}`)
  },
  adminProject: (id) => request(`/admin/projects/${id}`),
}
