import { ReactNode, useState } from 'react'
import { LucideIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface HelpSectionProps {
  id: string
  title: string
  titleHe: string
  icon: LucideIcon
  children: ReactNode
  defaultOpen?: boolean
}

export default function HelpSection({
  id,
  title,
  titleHe,
  icon: Icon,
  children,
  defaultOpen = true
}: HelpSectionProps) {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section id={id} className="glass-card mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-500/20">
            <Icon size={20} className="text-primary-400" />
          </div>
          <h2 className="text-lg font-semibold text-dark-100">
            {isRTL ? titleHe : title}
          </h2>
        </div>
        {isOpen ? (
          <ChevronUp size={20} className="text-dark-400" />
        ) : (
          <ChevronDown size={20} className="text-dark-400" />
        )}
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 pt-0 border-t border-white/5">
          {children}
        </div>
      </div>
    </section>
  )
}
