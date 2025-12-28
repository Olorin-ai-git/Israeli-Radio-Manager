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
        </Routes>
      </Layout>
      <ToastContainer />
    </div>
  )
}

export default App
