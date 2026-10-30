import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppStateProvider } from './lib/AppState.jsx'
import { LanguageProvider } from './lib/i18n.jsx'
import Layout from './components/Layout.jsx'
import ExploreCases from './pages/ExploreCases.jsx'
import CaseDetail from './pages/CaseDetail.jsx'
import Studio from './pages/Studio.jsx'
import AdminConsole from './pages/AdminConsole.jsx'

function Routed() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/cases" replace />} />
        <Route path="/cases" element={<ExploreCases />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/admin" element={<AdminConsole />} />
        <Route path="*" element={<Navigate to="/cases" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AppStateProvider>
        <BrowserRouter>
          <Routed />
        </BrowserRouter>
      </AppStateProvider>
    </LanguageProvider>
  )
}
