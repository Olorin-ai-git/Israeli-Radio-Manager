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
import CampaignManager from './pages/CampaignManager'
import Admin from './pages/Admin'
import Login from './pages/Login'
import VoiceManagement from './pages/VoiceManagement'
import ProtectedRoute from './components/Auth/ProtectedRoute'
import ToastContainer from './components/Toast/ToastContainer'
import { useAuth } from './contexts/AuthContext'

function App() {
  const { i18n } = useTranslation()
  const { dbUser } = useAuth()
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr')

  // Apply user preferences when logged in
  useEffect(() => {
    if (dbUser?.preferences) {
      // Apply language preference
      const userLang = dbUser.preferences.language
      if (userLang && userLang !== i18n.language) {
        i18n.changeLanguage(userLang)
      }

      // Apply theme preference (add class to document for CSS targeting)
      const theme = dbUser.preferences.theme || 'dark'
      document.documentElement.setAttribute('data-theme', theme)
      document.body.classList.remove('theme-dark', 'theme-light')
      document.body.classList.add(`theme-${theme}`)
    }
  }, [dbUser, i18n])

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
                  <Route path="/campaigns" element={<CampaignManager />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/agent" element={<AgentControl />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route
                    path="/voices"
                    element={
                      <ProtectedRoute requireAdmin>
                        <VoiceManagement />
                      </ProtectedRoute>
                    }
                  />
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
