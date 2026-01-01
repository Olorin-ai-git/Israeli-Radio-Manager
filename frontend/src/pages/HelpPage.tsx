import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Rocket,
  LayoutDashboard,
  Workflow,
  Music,
  Calendar,
  Megaphone,
  Users,
  HelpCircle,
  BookOpen
} from 'lucide-react'
import HelpSection from '../components/Help/HelpSection'
import HelpNavigation from '../components/Help/HelpNavigation'
import QuickStartGuide from '../components/Help/QuickStartGuide'
import DashboardGuide from '../components/Help/DashboardGuide'
import ActionsStudioGuide from '../components/Help/ActionsStudioGuide'
import ContentGuide from '../components/Help/ContentGuide'
import CalendarGuide from '../components/Help/CalendarGuide'
import CampaignGuide from '../components/Help/CampaignGuide'
import RoleGuide from '../components/Help/RoleGuide'
import SupportSection from '../components/Help/SupportSection'

export default function HelpPage() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const [activeSection, setActiveSection] = useState('quick-start')

  // Track active section based on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]')
      let currentSection = 'quick-start'

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect()
        if (rect.top <= 150) {
          currentSection = section.id
        }
      })

      setActiveSection(currentSection)
    }

    const container = document.getElementById('help-content')
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-500/20">
            <BookOpen size={28} className="text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-100">
              {isRTL ? 'מדריך למשתמש' : 'User Guide'}
            </h1>
            <p className="text-dark-400 mt-1">
              {isRTL
                ? 'מצא תשובות, למד את המערכת וקבל תמיכה'
                : 'Find answers, learn the system, and get support'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <HelpNavigation activeSection={activeSection} onNavigate={setActiveSection} />

        {/* Scrollable Content */}
        <div id="help-content" className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <HelpSection
              id="quick-start"
              title="Quick Start"
              titleHe="התחלה מהירה"
              icon={Rocket}
            >
              <QuickStartGuide />
            </HelpSection>

            <HelpSection
              id="dashboard"
              title="Dashboard"
              titleHe="לוח בקרה"
              icon={LayoutDashboard}
            >
              <DashboardGuide />
            </HelpSection>

            <HelpSection
              id="actions"
              title="Actions Studio"
              titleHe="סטודיו פעולות"
              icon={Workflow}
            >
              <ActionsStudioGuide />
            </HelpSection>

            <HelpSection
              id="content"
              title="Content Management"
              titleHe="ניהול תוכן"
              icon={Music}
            >
              <ContentGuide />
            </HelpSection>

            <HelpSection
              id="calendar"
              title="Calendar"
              titleHe="לוח שנה"
              icon={Calendar}
            >
              <CalendarGuide />
            </HelpSection>

            <HelpSection
              id="campaigns"
              title="Campaign Manager"
              titleHe="מנהל קמפיינים"
              icon={Megaphone}
            >
              <CampaignGuide />
            </HelpSection>

            <HelpSection
              id="roles"
              title="By Role"
              titleHe="לפי תפקיד"
              icon={Users}
            >
              <RoleGuide />
            </HelpSection>

            <HelpSection
              id="support"
              title="Support"
              titleHe="תמיכה"
              icon={HelpCircle}
            >
              <SupportSection />
            </HelpSection>
          </div>
        </div>
      </div>
    </div>
  )
}
