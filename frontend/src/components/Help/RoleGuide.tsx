import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Building2, UserCog, Headphones, Mic2 } from 'lucide-react'

interface RoleTabProps {
  icon: React.ReactNode
  title: string
  titleHe: string
  isActive: boolean
  onClick: () => void
}

function RoleTab({ icon, title, titleHe, isActive, onClick }: RoleTabProps) {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-primary-500/20 text-primary-400'
          : 'text-dark-400 hover:bg-white/5 hover:text-dark-200'
      }`}
    >
      {icon}
      <span className="font-medium">{isRTL ? titleHe : title}</span>
    </button>
  )
}

export default function RoleGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const [activeRole, setActiveRole] = useState('owners')

  const roles = [
    { id: 'owners', icon: <Building2 size={18} />, title: 'Owners', titleHe: 'בעלים' },
    { id: 'managers', icon: <UserCog size={18} />, title: 'Managers', titleHe: 'מנהלים' },
    { id: 'operators', icon: <Headphones size={18} />, title: 'Operators', titleHe: 'אופרטורים' },
    { id: 'anchors', icon: <Mic2 size={18} />, title: 'Anchors', titleHe: 'שדרנים' },
  ]

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'מדריך זה מותאם לתפקיד שלכם בתחנה. בחרו את התפקיד שלכם למידע רלוונטי.'
          : 'This guide is tailored to your role at the station. Select your role for relevant information.'}
      </p>

      {/* Role Tabs */}
      <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-dark-800/50 border border-white/5">
        {roles.map((role) => (
          <RoleTab
            key={role.id}
            icon={role.icon}
            title={role.title}
            titleHe={role.titleHe}
            isActive={activeRole === role.id}
            onClick={() => setActiveRole(role.id)}
          />
        ))}
      </div>

      {/* Role Content */}
      <div className="mt-6">
        {activeRole === 'owners' && <OwnersGuide isRTL={isRTL} />}
        {activeRole === 'managers' && <ManagersGuide isRTL={isRTL} />}
        {activeRole === 'operators' && <OperatorsGuide isRTL={isRTL} />}
        {activeRole === 'anchors' && <AnchorsGuide isRTL={isRTL} />}
      </div>
    </div>
  )
}

function OwnersGuide({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h3 className="font-semibold text-primary-400 mb-2">
          {isRTL ? 'לבעלי תחנות' : 'For Station Owners'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'כבעלי התחנה, אתם צריכים להבין את התמונה הגדולה ולעקוב אחרי הביצועים.'
            : 'As the station owner, you need to understand the big picture and track performance.'}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-dark-100">{isRTL ? 'תכונות מפתח עבורכם' : 'Key Features for You'}</h4>

        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <h5 className="font-medium text-dark-100 mb-2">{isRTL ? 'מעקב הכנסות מקמפיינים' : 'Campaign Revenue Tracking'}</h5>
            <ul className="list-disc list-inside text-dark-300 text-sm space-y-1">
              <li>{isRTL ? 'צפו בכל הקמפיינים הפעילים' : 'View all active campaigns'}</li>
              <li>{isRTL ? 'בדקו כיסוי תזמון' : 'Check schedule coverage'}</li>
              <li>{isRTL ? 'עקבו אחרי מספר ההשמעות' : 'Track play counts'}</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <h5 className="font-medium text-dark-100 mb-2">{isRTL ? 'סקירת לוח שנה' : 'Calendar Overview'}</h5>
            <ul className="list-disc list-inside text-dark-300 text-sm space-y-1">
              <li>{isRTL ? 'כל הזרימות המתוזמנות' : 'All scheduled flows'}</li>
              <li>{isRTL ? 'טווחי תאריכים של קמפיינים' : 'Campaign date ranges'}</li>
              <li>{isRTL ? 'אירועים מיוחדים' : 'Special events'}</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <h5 className="font-medium text-dark-100 mb-2">{isRTL ? 'בריאות המערכת' : 'System Health'}</h5>
            <p className="text-dark-300 text-sm">
              {isRTL
                ? 'לוח הבקרה מציג סטטוס השמעה נוכחי, אורך התור ושגיאות או אזהרות.'
                : 'The dashboard shows current playback status, queue length, and any errors or warnings.'}
            </p>
          </div>
        </div>

        <h4 className="font-semibold text-dark-100 mt-6">{isRTL ? 'משימות נפוצות' : 'Common Tasks'}</h4>

        <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
          <h5 className="font-medium text-dark-100 mb-2">{isRTL ? 'הוספת מפרסם חדש' : 'Adding a New Advertiser'}</h5>
          <ol className="list-decimal list-inside text-dark-300 text-sm space-y-1">
            <li>{isRTL ? 'צרו קמפיין חדש' : 'Create a new campaign'}</li>
            <li>{isRTL ? 'העלו את קבצי הפרסומת שלהם' : 'Upload their commercial files'}</li>
            <li>{isRTL ? 'הגדירו את התזמון והעדיפות' : 'Set the schedule and priority'}</li>
            <li>{isRTL ? 'הפעילו ועקבו' : 'Activate and monitor'}</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

function ManagersGuide({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h3 className="font-semibold text-primary-400 mb-2">
          {isRTL ? 'למנהלי תחנות' : 'For Station Managers'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'כמנהלים, אתם אחראים על התפעול היומיומי והתזמון.'
            : 'As managers, you handle day-to-day operations and scheduling.'}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-dark-100">{isRTL ? 'ניהול זרימות' : 'Flow Management'}</h4>
        <p className="text-dark-300 text-sm">
          {isRTL
            ? 'צרו ותחזקו את זרימות התכנות שלכם:'
            : 'Create and maintain your programming flows:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 text-sm space-y-1 mr-4">
          <li>{isRTL ? 'זרימת תוכנית בוקר' : 'Morning show flow'}</li>
          <li>{isRTL ? 'זרימת צהריים' : 'Afternoon drive flow'}</li>
          <li>{isRTL ? 'תכנות ערב' : 'Evening programming'}</li>
          <li>{isRTL ? 'אוטומציה לילית' : 'Overnight automation'}</li>
        </ul>

        <h4 className="font-semibold text-dark-100 mt-6">{isRTL ? 'טיפים לעיצוב זרימות' : 'Flow Design Tips'}</h4>
        <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
          <ul className="list-disc list-inside text-dark-300 text-sm space-y-2">
            <li>{isRTL ? 'שמרו על זרימות מודולריות (בוקר, צהריים, ערב)' : 'Keep flows modular (morning, afternoon, evening)'}</li>
            <li>{isRTL ? 'השתמשו בתצוגה מקדימה לפני העלאה לאוויר' : 'Use the preview feature before going live'}</li>
            <li>{isRTL ? 'הגדירו עדיפויות מתאימות' : 'Set appropriate priorities'}</li>
          </ul>
        </div>

        <h4 className="font-semibold text-dark-100 mt-6">{isRTL ? 'טיפים לתזמון קמפיינים' : 'Campaign Scheduling Tips'}</h4>
        <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
          <ul className="list-disc list-inside text-dark-300 text-sm space-y-2">
            <li>{isRTL ? 'עדיפות גבוהה (7-9) לספונסרים פרימיום' : 'Higher priority (7-9) for premium sponsors'}</li>
            <li>{isRTL ? 'עדיפות בינונית (4-6) למפרסמים רגילים' : 'Medium priority (4-6) for regular advertisers'}</li>
            <li>{isRTL ? 'עדיפות נמוכה (1-3) לפרומו של הבית' : 'Lower priority (1-3) for house promos'}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function OperatorsGuide({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h3 className="font-semibold text-primary-400 mb-2">
          {isRTL ? 'לאופרטורים' : 'For Operators'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'כאופרטורים, אתם מנהלים את ההשמעה בזמן אמת.'
            : 'As operators, you manage real-time playback.'}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-dark-100">{isRTL ? 'פקדי לוח הבקרה' : 'Dashboard Controls'}</h4>
        <p className="text-dark-300 text-sm">
          {isRTL ? 'סביבת העבודה העיקרית שלכם:' : 'Your main workspace:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 text-sm space-y-1 mr-4">
          <li>{isRTL ? 'נגן/השהה רצועה נוכחית' : 'Play/pause current track'}</li>
          <li>{isRTL ? 'דלג לפריט הבא' : 'Skip to next item'}</li>
          <li>{isRTL ? 'כוון עוצמה' : 'Adjust volume'}</li>
          <li>{isRTL ? 'עקוב אחרי התור' : 'Monitor queue'}</li>
        </ul>

        <HelpScreenshot
          src="/help/Dashboard.jpg"
          alt="Player controls"
          caption="Dashboard player controls"
          captionHe="פקדי הנגן בלוח הבקרה"
        />

        <h4 className="font-semibold text-dark-100 mt-6">{isRTL ? 'פתרון בעיות' : 'Troubleshooting'}</h4>

        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <h5 className="font-medium text-dark-100 mb-2">{isRTL ? 'אודיו לא מתנגן' : 'Audio Not Playing'}</h5>
            <ol className="list-decimal list-inside text-dark-300 text-sm space-y-1">
              <li>{isRTL ? 'בדקו רמת עוצמה' : 'Check volume level'}</li>
              <li>{isRTL ? 'ודאו שיש פריטים בתור' : 'Verify queue has items'}</li>
              <li>{isRTL ? 'בדקו הרשאות אודיו בדפדפן' : 'Check browser audio permissions'}</li>
            </ol>
          </div>

          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <h5 className="font-medium text-dark-100 mb-2">{isRTL ? 'קמפיין לא מופעל' : 'Campaign Not Triggering'}</h5>
            <ol className="list-decimal list-inside text-dark-300 text-sm space-y-1">
              <li>{isRTL ? 'ודאו שהקמפיין פעיל' : 'Verify campaign is active'}</li>
              <li>{isRTL ? 'בדקו את רשת התזמון למשבצת הנוכחית' : 'Check schedule grid for current slot'}</li>
              <li>{isRTL ? 'השתמשו ב"הפעל עכשיו" לבדיקה' : 'Use "Run Now" to test'}</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnchorsGuide({ isRTL }: { isRTL: boolean }) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h3 className="font-semibold text-primary-400 mb-2">
          {isRTL ? "לשדרנים ודי.ג'ייז" : 'For Anchors & DJs'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'כשדרנים, אתם מתמקדים בתוכן, לא בטכנולוגיה.'
            : 'As anchors, you focus on the content, not the tech.'}
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-dark-100">{isRTL ? 'מה שאתם צריכים לדעת' : 'What You Need to Know'}</h4>

        <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
          <h5 className="font-medium text-dark-100 mb-2">{isRTL ? 'לוח הבקרה' : 'The Dashboard'}</h5>
          <p className="text-dark-300 text-sm">
            {isRTL
              ? 'כשאתם פותחים את הפורטל, תראו: מה מתנגן כעת, מה הבא בתור, ופקדי השמעה בסיסיים.'
              : 'When you open the portal, you\'ll see: what\'s currently playing, what\'s next, and basic playback controls.'}
          </p>
        </div>

        <HelpScreenshot
          src="/help/Dashboard.jpg"
          alt="Dashboard"
          caption="The main dashboard"
          captionHe="לוח הבקרה הראשי"
        />

        <h4 className="font-semibold text-dark-100 mt-6">{isRTL ? 'התפקיד שלכם' : 'Your Role'}</h4>
        <ul className="list-disc list-inside text-dark-300 text-sm space-y-1 mr-4">
          <li>{isRTL ? 'עקבו אחרי מה שמתנגן' : 'Monitor what\'s playing'}</li>
          <li>{isRTL ? 'תאמו עם האופרטורים לשינויים' : 'Coordinate with operators for changes'}</li>
          <li>{isRTL ? 'התמקדו בתוכן התוכנית שלכם' : 'Focus on your show content'}</li>
        </ul>

        <h4 className="font-semibold text-dark-100 mt-6">{isRTL ? 'מדריך מהיר' : 'Quick Reference'}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-right p-2 text-dark-300">{isRTL ? 'פעולה' : 'Action'}</th>
                <th className="text-right p-2 text-dark-300">{isRTL ? 'מי מטפל' : 'Who Handles It'}</th>
              </tr>
            </thead>
            <tbody className="text-dark-400">
              <tr className="border-b border-white/5">
                <td className="p-2">{isRTL ? 'תכנות רגיל' : 'Regular programming'}</td>
                <td className="p-2">{isRTL ? 'זרימות אוטומטיות' : 'Automatic flows'}</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-2">{isRTL ? 'הפסקות פרסומת' : 'Commercial breaks'}</td>
                <td className="p-2">{isRTL ? 'מתזמן קמפיינים' : 'Campaign scheduler'}</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="p-2">{isRTL ? 'בקשות מיוחדות' : 'Special requests'}</td>
                <td className="p-2">{isRTL ? 'דברו עם האופרטור' : 'Talk to operator'}</td>
              </tr>
              <tr>
                <td className="p-2">{isRTL ? 'בעיות טכניות' : 'Technical issues'}</td>
                <td className="p-2">{isRTL ? 'פנו למנהל' : 'Contact manager'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
