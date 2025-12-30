import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Upload from './pages/Upload'
import AgentControl from './pages/AgentControl'
import Settings from './pages/Settings'
import CalendarPlaylist from './pages/CalendarPlaylist'
import ActionsStudio from './pages/ActionsStudio'
import Admin from './pages/Admin'
import Login from './pages/Login'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import ToastContainer from './components/Toast/ToastContainer'

function App() {
  const { i18n } = useTranslation()
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr')

  useEffect(() => {
    // Set direction based on language
    const newDir = i18n.language === 'he' ? 'rtl' : 'ltr'
    setDir(newDir)
    document.documentElement.dir = newDir
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  return (
    <div dir={dir} className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/calendar" element={<CalendarPlaylist />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/agent" element={<AgentControl />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/actions-studio" element={<ActionsStudio />} />
                  <Route path="/actions-studio/:flowId" element={<ActionsStudio />} />
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requireAdmin>
                        <Admin />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      <ToastContainer />
    </div>
  )
}

export default App
