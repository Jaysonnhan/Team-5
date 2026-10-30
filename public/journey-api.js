/** Read-only client for a separate search frontend. No database credentials required. */
export function createJourneyClient(baseUrl = 'https://dream-journey-student-demo.finelemur1028.chatgpt.site') {
  const origin = baseUrl.replace(/\/$/, '');
  const absolute = file => ({ ...file, url: new URL(file.url, origin).href });
  async function get(path) {
    const response = await fetch(origin + '/api/v1/' + path, { credentials: 'omit' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load cases.');
    return data;
  }
  return {
    async search({ q = '', limit = 20, offset = 0 } = {}) {
      return get('cases?' + new URLSearchParams({ q, limit: String(limit), offset: String(offset) }));
    },
    async getCase(id) {
      const data = await get('cases/' + encodeURIComponent(id));
      return { ...data.case, files: data.case.files.map(absolute) };
    },
    submissionUrl: origin + '/student.html',
  };
}
