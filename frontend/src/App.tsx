import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Library from './pages/Library'
import Upload from './pages/Upload'
import AgentControl from './pages/AgentControl'
import Settings from './pages/Settings'

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
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/library" element={<Library />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/agent" element={<AgentControl />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </div>
  )
}

export default App
