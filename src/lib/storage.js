import { seedCases, seedEntries } from '../data/seedCases.js'

const STORAGE_KEY = 'dream-journey-prototype.v4'

function readRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function defaultState() {
  return {
    role: 'team',
    entries: seedEntries.map((e) => ({ ...e })),
    caseStatus: {},
  }
}

export function loadState() {
  const stored = readRaw()
  const base = defaultState()
  if (!stored) return base
  return {
    role: stored.role || base.role,
    entries: Array.isArray(stored.entries) ? stored.entries : base.entries,
    caseStatus: stored.caseStatus && typeof stored.caseStatus === 'object' ? stored.caseStatus : {},
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ role: state.role, entries: state.entries, caseStatus: state.caseStatus }),
    )
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message:
        'Browser storage is full, so this change is only kept in memory for this session. Delete a photo entry and try again.',
    }
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function casesWithStatus(cases, caseStatus) {
  return cases.map((k) => ({ ...k, status: caseStatus[k.id] || k.status }))
}

export const SEED_CASES = seedCases
