import { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Rocket,
  LayoutDashboard,
  Workflow,
  Music,
  Calendar,
  Megaphone,
  Users,
  HelpCircle
} from 'lucide-react'

interface NavItem {
  id: string
  title: string
  titleHe: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: 'quick-start', title: 'Quick Start', titleHe: 'התחלה מהירה', icon: Rocket },
  { id: 'dashboard', title: 'Dashboard', titleHe: 'לוח בקרה', icon: LayoutDashboard },
  { id: 'actions', title: 'Actions Studio', titleHe: 'סטודיו פעולות', icon: Workflow },
  { id: 'content', title: 'Content', titleHe: 'ניהול תוכן', icon: Music },
  { id: 'calendar', title: 'Calendar', titleHe: 'לוח שנה', icon: Calendar },
  { id: 'campaigns', title: 'Campaigns', titleHe: 'קמפיינים', icon: Megaphone },
  { id: 'roles', title: 'By Role', titleHe: 'לפי תפקיד', icon: Users },
  { id: 'support', title: 'Support', titleHe: 'תמיכה', icon: HelpCircle },
]

interface HelpNavigationProps {
  activeSection: string
  onNavigate: (sectionId: string) => void
}

export default function HelpNavigation({ activeSection, onNavigate }: HelpNavigationProps) {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  const handleClick = (id: string) => {
    onNavigate(id)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className={`w-56 flex-shrink-0 glass-sidebar p-4 ${isRTL ? 'border-l border-white/5' : 'border-r border-white/5'}`}>
      <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-4">
        {isRTL ? 'ניווט' : 'Navigation'}
      </h3>
      <ul className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <li key={item.id}>
              <button
                onClick={() => handleClick(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-dark-300 hover:bg-white/5 hover:text-dark-100'
                }`}
              >
                <Icon size={16} />
                <span>{isRTL ? item.titleHe : item.title}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
