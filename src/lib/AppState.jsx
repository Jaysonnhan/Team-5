import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { casesWithStatus, defaultState, loadState, saveState, clearState, SEED_CASES } from './storage.js'
import { api } from './api.js'

const AppStateContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, role: action.role }

    case 'ADD_ENTRY':
      return { ...state, entries: [...state.entries, action.entry] }

    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((entry) => (entry.id === action.id ? { ...entry, ...action.patch } : entry)),
      }

    case 'DELETE_ENTRY':
      return { ...state, entries: state.entries.filter((entry) => entry.id !== action.id) }

    case 'SET_CASE_STATUS':
      return { ...state, caseStatus: { ...state.caseStatus, [action.caseId]: action.status } }

    case 'RESET_DEMO':
      return { ...defaultState(), role: state.role }

    default:
      return state
  }
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadState)
  const [remoteCases, setRemoteCases] = useState([])
  const [remoteLoading, setRemoteLoading] = useState(true)
  const [remoteError, setRemoteError] = useState('')

  const refreshCases = useCallback(async () => {
    setRemoteLoading(true)
    try {
      const data = await api.getCases()
      setRemoteCases(data.cases)
      setRemoteError('')
    } catch (error) {
      setRemoteError(error.message)
    } finally {
      setRemoteLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCases()
  }, [refreshCases])

  useEffect(() => {
    const result = saveState(state)
    if (!result.ok) console.warn(result.message)
  }, [state.role, state.entries, state.caseStatus])

  const cases = useMemo(
    () => [...casesWithStatus(SEED_CASES, state.caseStatus), ...remoteCases],
    [state.caseStatus, remoteCases],
  )

  const value = useMemo(
    () => ({
      ...state,
      cases,
      remoteLoading,
      remoteError,
      dispatch,
      refreshCases,
      findCase: (id) => cases.find((kase) => kase.id === id),
      entriesFor: (caseId) => state.entries.filter((entry) => entry.caseId === caseId),
      setRole: (role) => dispatch({ type: 'SET_ROLE', role }),
      addEntry: (entry) => dispatch({ type: 'ADD_ENTRY', entry }),
      updateEntry: (id, patch) => dispatch({ type: 'UPDATE_ENTRY', id, patch }),
      deleteEntry: (id) => dispatch({ type: 'DELETE_ENTRY', id }),
      setCaseStatus: (caseId, status) => dispatch({ type: 'SET_CASE_STATUS', caseId, status }),
      resetDemo: () => {
        clearState()
        dispatch({ type: 'RESET_DEMO' })
      },
    }),
    [state, cases, remoteLoading, remoteError, refreshCases],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) throw new Error('useAppState must be used inside AppStateProvider')
  return context
}
