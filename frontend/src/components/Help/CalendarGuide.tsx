import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Calendar, RefreshCw, Repeat, Music, Play, Plus, Filter } from 'lucide-react'

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

      {/* Week View */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Calendar size={20} className="text-primary-400" />
          {isRTL ? 'תצוגת שבוע' : 'Week View'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'הלוח מציג שבוע שלם עם 7 עמודות - עמודה לכל יום. תוכלו:'
            : 'The calendar shows a full week with 7 columns - one for each day. You can:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'נווטו בין שבועות עם החיצים' : 'Navigate between weeks using arrows'}</li>
          <li>{isRTL ? 'לחצו על "היום" לחזרה לשבוע הנוכחי' : 'Click "Today" to return to the current week'}</li>
          <li>{isRTL ? 'לחצו על אירוע לפרטים נוספים' : 'Click an event for more details'}</li>
          <li>{isRTL ? 'לחיצה כפולה על יום לתזמון מהיר' : 'Double-click a day for quick scheduling'}</li>
        </ul>
      </div>

      {/* Scheduling Content */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Plus size={20} className="text-emerald-400" />
          {isRTL ? 'תזמון תוכן' : 'Scheduling Content'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'לחצו על "הוסף לתזמון" לפתיחת חלון התזמון. תוכלו לתזמן:'
            : 'Click "Add to Schedule" to open the scheduling modal. You can schedule:'}
        </p>

        <div className="grid gap-3 mt-4">
          {/* Content Type */}
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Music size={18} className="text-blue-400" />
              </div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'תוכן' : 'Content'}</h4>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'שיר, תוכנית או פרסומת ספציפיים מהספרייה. סננו לפי סוג תוכן וז\'אנר.'
                : 'A specific song, show, or commercial from your library. Filter by content type and genre.'}
            </p>
          </div>

          {/* Flow Type */}
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Play size={18} className="text-purple-400" />
              </div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'זרימה' : 'Flow'}</h4>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'רצף פעולות שלם מסטודיו הפעולות. מושלם לתוכניות קבועות.'
                : 'A complete action sequence from Actions Studio. Perfect for regular shows.'}
            </p>
          </div>
        </div>
      </div>

      {/* Recurring Events */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Repeat size={20} className="text-amber-400" />
          {isRTL ? 'אירועים חוזרים' : 'Recurring Events'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'בעת תזמון, בחרו תדירות חזרה:'
            : 'When scheduling, select a recurrence frequency:'}
        </p>

        <div className="grid gap-2 mt-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50">
            <span className="font-medium text-dark-100 w-20">{isRTL ? 'פעם אחת' : 'Once'}</span>
            <span className="text-dark-400 text-sm">
              {isRTL ? 'אירוע חד-פעמי בתאריך ושעה ספציפיים' : 'One-time event at a specific date and time'}
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50">
            <span className="font-medium text-dark-100 w-20">{isRTL ? 'יומי' : 'Daily'}</span>
            <span className="text-dark-400 text-sm">
              {isRTL ? 'חוזר כל יום באותה שעה' : 'Repeats every day at the same time'}
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50">
            <span className="font-medium text-dark-100 w-20">{isRTL ? 'שבועי' : 'Weekly'}</span>
            <span className="text-dark-400 text-sm">
              {isRTL ? 'בחרו ימים ספציפיים בשבוע (למשל: א\'-ה\')' : 'Select specific days of the week (e.g., Sun-Thu)'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-3">
          <p className="text-sm text-amber-400">
            {isRTL
              ? 'אירועים חוזרים מסומנים עם אייקון חזרה. לחצו על אירוע חוזר כדי לראות את כל המופעים.'
              : 'Recurring events are marked with a repeat icon. Click a recurring event to see all instances.'}
          </p>
        </div>
      </div>

      {/* Content Filters */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Filter size={20} className="text-purple-400" />
          {isRTL ? 'סינון תוכן' : 'Content Filters'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'בעת תזמון תוכן, סננו לפי:'
            : 'When scheduling content, filter by:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'סוג תוכן (שיר, תוכנית, פרסומת)' : 'Content type (song, show, commercial)'}</li>
          <li>{isRTL ? 'ז\'אנר (לשירים)' : 'Genre (for songs)'}</li>
          <li>{isRTL ? 'מספר אצווה (לפרסומות)' : 'Batch number (for commercials)'}</li>
        </ul>
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
