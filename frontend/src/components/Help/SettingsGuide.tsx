import { useTranslation } from 'react-i18next'
import { Globe, Bell, Mail, Smartphone, Send, MessageSquare } from 'lucide-react'

export default function SettingsGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'דף ההגדרות מאפשר לכם להתאים אישית את חוויית המערכת, כולל שפה, התראות ופרטי יצירת קשר.'
          : 'The Settings page allows you to customize your system experience, including language, notifications, and contact details.'}
      </p>

      {/* Language Settings */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Globe size={20} className="text-primary-400" />
          {isRTL ? 'הגדרות שפה' : 'Language Settings'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'המערכת תומכת באנגלית ועברית. בחירת עברית תפעיל גם כיוון RTL (ימין לשמאל).'
            : 'The system supports English and Hebrew. Selecting Hebrew will also enable RTL (right-to-left) layout.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-dark-800/50 border border-white/5 text-center">
            <span className="text-2xl mb-1 block">US</span>
            <span className="text-sm text-dark-300">English</span>
          </div>
          <div className="p-3 rounded-lg bg-dark-800/50 border border-white/5 text-center">
            <span className="text-2xl mb-1 block">IL</span>
            <span className="text-sm text-dark-300">עברית</span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
          <p className="text-sm text-primary-400">
            {isRTL
              ? 'טיפ: העדפת השפה נשמרת בפרופיל המשתמש שלכם ותישמר בין התחברויות.'
              : 'Tip: Your language preference is saved to your user profile and persists across sessions.'}
          </p>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Bell size={20} className="text-amber-400" />
          {isRTL ? 'הגדרות התראות' : 'Notification Settings'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'בחרו כיצד לקבל התראות מהמערכת:'
            : 'Choose how to receive notifications from the system:'}
        </p>

        <div className="grid gap-3">
          {/* Email */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Mail size={18} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'התראות אימייל' : 'Email Notifications'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'קבלו התראות לכתובת האימייל הרשומה' : 'Receive alerts to your registered email address'}
              </p>
            </div>
            <button className="px-3 py-1.5 text-sm glass-button flex items-center gap-2">
              <Send size={14} />
              Test
            </button>
          </div>

          {/* Push */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Bell size={18} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'התראות דפדפן (Push)' : 'Browser Push Notifications'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'קבלו התראות ישירות בדפדפן גם כשהמערכת סגורה' : 'Receive notifications in your browser even when the app is closed'}
              </p>
            </div>
          </div>

          {/* SMS */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Smartphone size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'התראות SMS' : 'SMS Notifications'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'התראות קריטיות ישלחו ב-SMS (דורש Twilio)' : 'Critical alerts sent via SMS (requires Twilio configuration)'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400">
            {isRTL
              ? 'לחצו על "Test" לצד כל ערוץ כדי לשלוח התראת בדיקה ולוודא שההגדרות תקינות.'
              : 'Click "Test" next to each channel to send a test notification and verify your settings work.'}
          </p>
        </div>
      </div>

      {/* Admin Contact */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <MessageSquare size={20} className="text-purple-400" />
          {isRTL ? 'פרטי קשר מנהל' : 'Admin Contact'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'הגדירו את פרטי הקשר של מנהל המערכת לקבלת התראות קריטיות:'
            : 'Set the system administrator contact details for receiving critical alerts:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'אימייל מנהל - לקבלת דוחות ושגיאות' : 'Admin Email - for reports and errors'}</li>
          <li>{isRTL ? 'טלפון מנהל - להתראות SMS דחופות' : 'Admin Phone - for urgent SMS alerts'}</li>
        </ul>
      </div>

      {/* Save Reminder */}
      <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-white/5">
        <h4 className="font-semibold text-dark-100 mb-2">
          {isRTL ? 'שמירת שינויים' : 'Saving Changes'}
        </h4>
        <p className="text-dark-300 text-sm">
          {isRTL
            ? 'לחצו על כפתור "שמור" בכל קטע לאחר ביצוע שינויים. שינויי שפה נשמרים אוטומטית.'
            : 'Click the "Save" button in each section after making changes. Language changes are saved automatically.'}
        </p>
      </div>
    </div>
  )
}
