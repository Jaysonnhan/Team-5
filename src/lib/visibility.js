import { l } from './text.js'

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

export const roleLabel = (role) =>
  role === 'visitor' ? l('Public Visitor', '公众访客') : l('Student', '学生')

export const roleHint = (role) =>
  role === 'visitor'
    ? l('Read-only, published cases only', '只读浏览，仅显示已发布案例')
    : l('Case library and project workspace in one view', '案例库与项目工作台一体化视图')

export const kindLabel = (kind) => {
  const labels = {
    observation: ['Observation', '观察'],
    question: ['Question', '问题'],
    reflection: ['Reflection', '反思'],
    photo: ['Photo', '照片'],
  }
  const pair = labels[kind]
  return pair ? l(pair[0], pair[1]) : kind
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
