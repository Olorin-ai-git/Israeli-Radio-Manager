import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  CalendarDays,
  Library,
  Upload,
  Bot,
  Settings,
  MessageCircle,
  Globe
} from 'lucide-react'
import ChatSidebar from '../Agent/ChatSidebar'
import AudioPlayer from '../Player/AudioPlayer'
import FlowsPanel from '../Flows/FlowsPanel'
import { usePlayerStore } from '../../store/playerStore'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [chatExpanded, setChatExpanded] = useState(false)
  const [flowsCollapsed, setFlowsCollapsed] = useState(true)
  const { currentTrack, playNext } = usePlayerStore()

  const isRTL = i18n.language === 'he'

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/calendar', icon: CalendarDays, label: isRTL ? 'לוח שידורים' : 'Broadcast Schedule' },
    { path: '/library', icon: Library, label: t('nav.library') },
    { path: '/upload', icon: Upload, label: t('nav.upload') },
    { path: '/agent', icon: Bot, label: t('nav.agent') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'he' : 'en')
  }

  return (
    <div className="flex h-screen bg-dark-950">
      {/* Background gradient overlay */}
      <div className="fixed inset-0 bg-gradient-dark pointer-events-none" />

      {/* Decorative blur circles */}
      <div className="fixed top-20 left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-80 h-80 bg-primary-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Flows Panel - Left side collapsible */}
      <FlowsPanel
        collapsed={flowsCollapsed}
        onToggle={() => setFlowsCollapsed(!flowsCollapsed)}
      />

      {/* Sidebar Navigation */}
      <nav className="relative z-10 w-64 glass-sidebar flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/Logo.png"
                alt="Israeli Radio Manager"
                className="w-12 h-12 object-contain"
              />
              <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-xl -z-10" />
            </div>
            <div>
              <h1 className="font-bold text-dark-100">{t('app.name')}</h1>
              <p className="text-xs text-dark-400">{t('app.tagline')}</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <Icon size={20} className={isActive ? 'text-primary-400' : ''} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Language Toggle */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 text-dark-400 hover:text-dark-100 transition-colors"
          >
            <Globe size={20} />
            <span>{i18n.language === 'en' ? 'עברית' : 'English'}</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-auto flex flex-col">
        <div className="flex-1 overflow-auto">
          {children}
        </div>

        {/* Audio Player - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-white/5">
          <AudioPlayer
            track={currentTrack}
            onTrackEnd={playNext}
            onNext={playNext}
          />
        </div>
      </main>

      {/* Chat Sidebar Toggle Button - Always on right */}
      <button
        onClick={() => setChatExpanded(!chatExpanded)}
        className={`fixed right-0 rounded-l-xl top-1/2 -translate-y-1/2 z-40
          glass-button-primary p-3 shadow-glow
          ${chatExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}
          flex items-center gap-2 transition-all duration-300`}
        title={t('chat.expand')}
      >
        <MessageCircle size={24} />
        <span className="text-sm font-medium hidden md:inline">
          {isRTL ? 'דבר עם הסוכן' : 'Chat'}
        </span>
      </button>

      {/* Chat Sidebar */}
      <ChatSidebar
        expanded={chatExpanded}
        onToggle={() => setChatExpanded(!chatExpanded)}
      />
    </div>
  )
}
