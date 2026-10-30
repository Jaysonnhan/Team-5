export const ROLES = {
  team: { id: 'team', label: 'Student', hint: 'Case library and project workspace in one view' },
  visitor: { id: 'visitor', label: 'Public Visitor', hint: 'Read-only, published cases only' },
}

export const ENTRY_KINDS = {
  observation: { label: 'Observation', accent: 'teal' },
  question: { label: 'Question', accent: 'amber' },
  reflection: { label: 'Reflection', accent: 'plum' },
  photo: { label: 'Photo', accent: 'clay' },
}

export const isTeam = (role) => role === 'team'

export function canViewCase(role, kase) {
  if (kase.status === 'published') return true
  return isTeam(role)
}

export function canViewEntry(role, entry) {
  if (entry.visibility === 'public') return true
  return isTeam(role)
}

export function visibleCases(role, cases) {
  return cases.filter((k) => canViewCase(role, k))
}

export function visibleEntriesForCase(role, entries, kase) {
  return entries
    .filter((e) => e.caseId === kase.id && canViewEntry(role, e))
    .filter((e) => kase.status === 'published' || isTeam(role))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
