import { useTranslation } from 'react-i18next'
import { Shield, Users, Settings, Bot, HardDrive, FileText, Activity, AlertCircle } from 'lucide-react'

export default function AdminGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  const adminTabs = [
    {
      icon: Users,
      name: 'Users',
      nameHe: 'משתמשים',
      desc: 'Manage user accounts, roles, and permissions',
      descHe: 'ניהול חשבונות משתמשים, תפקידים והרשאות',
      color: 'text-primary-400',
      bg: 'bg-primary-500/20'
    },
    {
      icon: Settings,
      name: 'System Config',
      nameHe: 'הגדרות מערכת',
      desc: 'Environment variables and system settings',
      descHe: 'משתני סביבה והגדרות מערכת',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20'
    },
    {
      icon: Bot,
      name: 'AI Agent',
      nameHe: 'סוכן AI',
      desc: 'LLM model selection and API key management',
      descHe: 'בחירת מודל ונהול מפתחות API',
      color: 'text-amber-400',
      bg: 'bg-amber-500/20'
    },
    {
      icon: HardDrive,
      name: 'Storage & Sync',
      nameHe: 'אחסון וסנכרון',
      desc: 'Google Cloud Storage sync and monitoring',
      descHe: 'סנכרון ומעקב אחסון בענן',
      color: 'text-blue-400',
      bg: 'bg-blue-500/20'
    },
    {
      icon: FileText,
      name: 'Content Management',
      nameHe: 'ניהול תוכן',
      desc: 'Content statistics and quality monitoring',
      descHe: 'סטטיסטיקות תוכן ובקרת איכות',
      color: 'text-purple-400',
      bg: 'bg-purple-500/20'
    },
    {
      icon: Activity,
      name: 'Server Management',
      nameHe: 'ניהול שרת',
      desc: 'Server health, logs, and cache management',
      descHe: 'בריאות שרת, לוגים וניהול מטמון',
      color: 'text-red-400',
      bg: 'bg-red-500/20'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
        <Shield size={24} className="text-purple-400 mt-0.5" />
        <div>
          <h4 className="font-semibold text-purple-400 mb-1">
            {isRTL ? 'גישה מוגבלת' : 'Restricted Access'}
          </h4>
          <p className="text-dark-300 text-sm">
            {isRTL
              ? 'לוח הניהול זמין רק למנהלי מערכת. משתמשים רגילים לא יראו את הקישור בתפריט.'
              : 'The Admin Dashboard is only available to system administrators. Regular users won\'t see the link in the menu.'}
          </p>
        </div>
      </div>

      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'לוח הניהול מספק גישה לכל הגדרות המערכת, ניהול משתמשים ומעקב אחר בריאות השרת.'
          : 'The Admin Dashboard provides access to all system settings, user management, and server health monitoring.'}
      </p>

      {/* Admin Tabs Overview */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'טאבים בלוח הניהול' : 'Admin Dashboard Tabs'}
        </h3>

        <div className="grid gap-3">
          {adminTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <div key={tab.name} className="flex items-start gap-3 p-4 rounded-lg bg-dark-800/50 border border-white/5">
                <div className={`p-2 rounded-lg ${tab.bg}`}>
                  <Icon size={20} className={tab.color} />
                </div>
                <div>
                  <h4 className="font-medium text-dark-100">
                    {isRTL ? tab.nameHe : tab.name}
                  </h4>
                  <p className="text-sm text-dark-400">
                    {isRTL ? tab.descHe : tab.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Users Tab Details */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Users size={20} className="text-primary-400" />
          {isRTL ? 'ניהול משתמשים' : 'User Management'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'בטאב המשתמשים תוכלו:'
            : 'In the Users tab you can:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'צפייה בכל המשתמשים הרשומים' : 'View all registered users'}</li>
          <li>{isRTL ? 'שינוי תפקידים (Admin, Editor, Viewer)' : 'Change roles (Admin, Editor, Viewer)'}</li>
          <li>{isRTL ? 'הפעלה/השבתה של משתמשים' : 'Activate/deactivate users'}</li>
          <li>{isRTL ? 'צפייה בזמן התחברות אחרון' : 'View last login time'}</li>
        </ul>
      </div>

      {/* System Config Details */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Settings size={20} className="text-emerald-400" />
          {isRTL ? 'הגדרות מערכת' : 'System Configuration'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'הגדרות הסביבה מאורגנות לפי קטגוריות:'
            : 'Environment settings are organized by category:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'הגדרות בסיס נתונים' : 'Database settings'}</li>
          <li>{isRTL ? 'הגדרות Google APIs' : 'Google APIs configuration'}</li>
          <li>{isRTL ? 'שירותי AI' : 'AI services'}</li>
          <li>{isRTL ? 'הגדרות התראות' : 'Notification settings'}</li>
        </ul>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400">
            {isRTL
              ? 'שימו לב: שדות רגישים (מפתחות, סיסמאות) מוסתרים. לחצו "הצג" כדי לראות את הערך המלא.'
              : 'Note: Sensitive fields (keys, passwords) are masked. Click "Show" to reveal the full value.'}
          </p>
        </div>
      </div>

      {/* AI Agent Settings */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Bot size={20} className="text-amber-400" />
          {isRTL ? 'הגדרות סוכן AI' : 'AI Agent Settings'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'הגדירו את מודל ה-LLM והמפתחות:'
            : 'Configure the LLM model and API keys:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'בחירת מודל (GPT-4, Claude, וכו\')' : 'Model selection (GPT-4, Claude, etc.)'}</li>
          <li>{isRTL ? 'הזנת מפתח API מותאם אישית' : 'Custom API key entry'}</li>
          <li>{isRTL ? 'צפייה במקור המפתח הנוכחי' : 'View current key source'}</li>
        </ul>
      </div>

      {/* Server Management */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Activity size={20} className="text-red-400" />
          {isRTL ? 'ניהול שרת' : 'Server Management'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'מעקב אחר בריאות השרת וביצוע פעולות תחזוקה:'
            : 'Monitor server health and perform maintenance:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'צפייה בשימוש ב-CPU וזיכרון' : 'View CPU and memory usage'}</li>
          <li>{isRTL ? 'ניקוי מטמון' : 'Clear cache'}</li>
          <li>{isRTL ? 'מחיקת קבצי לוג' : 'Delete log files'}</li>
          <li>{isRTL ? 'הפעלה מחדש של שירותים' : 'Restart services'}</li>
        </ul>
      </div>

      {/* Warning */}
      <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-red-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-400 mb-1">
              {isRTL ? 'אזהרה' : 'Warning'}
            </h4>
            <p className="text-dark-300 text-sm">
              {isRTL
                ? 'שינויים בהגדרות המערכת עלולים להשפיע על כל המשתמשים. בצעו שינויים בזהירות וודאו שאתם מבינים את ההשלכות.'
                : 'Changes to system settings may affect all users. Make changes carefully and ensure you understand the implications.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
