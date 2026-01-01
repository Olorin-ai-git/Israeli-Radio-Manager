import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Calendar, RefreshCw, Clock, Repeat } from 'lucide-react'

export default function CalendarGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'לוח השנה מציג את כל הזרימות והקמפיינים המתוזמנים. זו הדרך לראות מה יפעל ומתי.'
          : 'The calendar displays all scheduled flows and campaigns. This is how you see what runs and when.'}
      </p>

      <HelpScreenshot
        src="/help/Broadcast-Schedule.jpg"
        alt="Calendar view"
        caption="The calendar overview"
        captionHe="סקירת לוח השנה"
      />

      {/* Views */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'תצוגות' : 'Views'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'תוכלו לעבור בין תצוגות שונות:'
            : 'You can switch between different views:'}
        </p>

        <div className="grid gap-3 mt-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50">
            <div className="p-2 rounded-lg bg-dark-700">
              <Calendar size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'יום' : 'Day'}</h4>
              <p className="text-sm text-dark-400">
                {isRTL ? 'תצוגה מפורטת של יום אחד' : 'Detailed view of a single day'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50">
            <div className="p-2 rounded-lg bg-dark-700">
              <Clock size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'שבוע' : 'Week'}</h4>
              <p className="text-sm text-dark-400">
                {isRTL ? 'תצוגת שבוע מלא' : 'Full week view'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50">
            <div className="p-2 rounded-lg bg-dark-700">
              <Repeat size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'חודש' : 'Month'}</h4>
              <p className="text-sm text-dark-400">
                {isRTL ? 'סקירה חודשית' : 'Monthly overview'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Color Coding */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'קידוד צבעים' : 'Color Coding'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'אירועים מקודדים בצבעים לפי סוג:'
            : 'Events are color-coded by type:'}
        </p>

        <div className="space-y-2 mt-4">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded bg-primary-500"></span>
            <span className="text-dark-300">{isRTL ? 'זרימות רגילות' : 'Regular flows'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded bg-amber-500"></span>
            <span className="text-dark-300">{isRTL ? 'קמפיינים פרסומיים' : 'Commercial campaigns'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded bg-purple-500"></span>
            <span className="text-dark-300">{isRTL ? 'תוכניות מיוחדות' : 'Special shows'}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded bg-emerald-500"></span>
            <span className="text-dark-300">{isRTL ? 'אירועים חיים' : 'Live events'}</span>
          </div>
        </div>
      </div>

      {/* Day Schedule */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'לוח זמנים יומי' : 'Day Schedule'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'לחיצה על יום פותחת את לוח הזמנים היומי המפורט:'
            : 'Clicking a day opens the detailed daily schedule:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'כל שעות היום בציר זמן' : 'All hours of the day on a timeline'}</li>
          <li>{isRTL ? 'זרימות וקמפיינים מוצגים כבלוקים' : 'Flows and campaigns shown as blocks'}</li>
          <li>{isRTL ? 'לחיצה על בלוק לפרטים נוספים' : 'Click a block for more details'}</li>
        </ul>

        <HelpScreenshot
          src="/help/Broadcast-Schedule.jpg"
          alt="Day schedule"
          caption="The detailed day schedule panel"
          captionHe="פאנל לוח הזמנים היומי המפורט"
        />
      </div>

      {/* Google Calendar Sync */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <RefreshCw size={20} className="text-primary-400" />
          {isRTL ? 'סנכרון Google Calendar' : 'Google Calendar Sync'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'המערכת מסנכרנת עם Google Calendar לתזמון מתקדם:'
            : 'The system syncs with Google Calendar for advanced scheduling:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'זרימות מוצגות בלוח Google שלכם' : 'Flows appear in your Google Calendar'}</li>
          <li>{isRTL ? 'תזמון דו-כיווני' : 'Two-way synchronization'}</li>
          <li>{isRTL ? 'התראות בנייד' : 'Mobile notifications'}</li>
        </ul>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h4 className="font-semibold text-primary-400 mb-2">
          {isRTL ? 'טיפ מקצועי' : 'Pro Tip'}
        </h4>
        <p className="text-dark-300 text-sm">
          {isRTL
            ? 'תזמנו זרימות חוזרות לפי ימים בשבוע. לדוגמה, "תוכנית בוקר" יכולה לרוץ כל יום ראשון עד חמישי ב-6:00.'
            : 'Schedule recurring flows by weekdays. For example, "Morning Show" can run every Sunday-Thursday at 6:00 AM.'}
        </p>
      </div>
    </div>
  )
}
