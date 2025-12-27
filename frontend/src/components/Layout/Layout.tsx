import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Calendar,
  Library,
  Upload,
  Bot,
  Settings,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Globe
} from 'lucide-react'
import ChatSidebar from '../Agent/ChatSidebar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [chatExpanded, setChatExpanded] = useState(false)

  const isRTL = i18n.language === 'he'

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/schedule', icon: Calendar, label: t('nav.schedule') },
    { path: '/library', icon: Library, label: t('nav.library') },
    { path: '/upload', icon: Upload, label: t('nav.upload') },
    { path: '/agent', icon: Bot, label: t('nav.agent') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'he' : 'en')
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img
              src="/Logo.png"
              alt="Israeli Radio Manager"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="font-bold text-gray-900">{t('app.name')}</h1>
              <p className="text-xs text-gray-500">{t('app.tagline')}</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Language Toggle */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Globe size={20} />
            <span>{i18n.language === 'en' ? 'עברית' : 'English'}</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>

      {/* Chat Sidebar Toggle Button */}
      <button
        onClick={() => setChatExpanded(!chatExpanded)}
        className={`fixed ${isRTL ? 'left-0 rounded-r-lg' : 'right-0 rounded-l-lg'} top-1/2 -translate-y-1/2 z-40
          bg-primary-500 text-white p-3 shadow-lg hover:bg-primary-600 transition-all
          ${chatExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}
          flex items-center gap-2`}
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
