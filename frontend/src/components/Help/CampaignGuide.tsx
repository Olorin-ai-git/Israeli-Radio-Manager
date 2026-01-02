import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Calendar, Grid, Mic, Play, AlertCircle, Copy, Save, CheckCircle, Clock } from 'lucide-react'

export default function CampaignGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'מנהל הקמפיינים מאפשר לכם לתזמן פרסומות והכרזות בצורה מדויקת. כל קמפיין מוגדר עם תוכן, טווח תאריכים, עדיפות ולוח זמנים.'
          : 'The Campaign Manager lets you schedule commercials and announcements precisely. Each campaign is defined with content, date range, priority, and schedule.'}
      </p>

      <HelpScreenshot
        src="/help/Campaign-Manager.jpg"
        alt="Campaign Manager"
        caption="The Campaign Manager overview"
        captionHe="סקירת מנהל הקמפיינים"
      />

      {/* What is a Campaign */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'מהו קמפיין?' : 'What is a Campaign?'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'קמפיין הוא חבילת פרסום מתוזמנת. כל קמפיין כולל:'
            : 'A campaign is a scheduled advertising package. Each campaign includes:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li><strong>{isRTL ? 'טווח תאריכים' : 'Date Range'}</strong> - {isRTL ? 'מתי הקמפיין פעיל' : 'When the campaign is active'}</li>
          <li><strong>{isRTL ? 'עדיפות (1-9)' : 'Priority (1-9)'}</strong> - {isRTL ? 'עדיפות גבוהה יותר מתנגנת קודם' : 'Higher priority plays first'}</li>
          <li><strong>{isRTL ? 'תוכן' : 'Content'}</strong> - {isRTL ? 'קבצי הפרסומות' : 'The commercial files'}</li>
          <li><strong>{isRTL ? 'רשת תזמון' : 'Schedule Grid'}</strong> - {isRTL ? 'מתי וכמה פעמים לנגן' : 'When and how often to play'}</li>
        </ul>
      </div>

      {/* Creating a Campaign */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'יצירת קמפיין' : 'Creating a Campaign'}
        </h3>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold">1</span>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'מידע בסיסי' : 'Basic Information'}</h4>
              <ul className="list-disc list-inside text-dark-300 text-sm mt-1 space-y-1">
                <li>{isRTL ? 'לחצו "הוסף קמפיין"' : 'Click "Add Campaign"'}</li>
                <li>{isRTL ? 'הזינו שם הקמפיין' : 'Enter campaign name'}</li>
                <li>{isRTL ? 'בחרו סוג (למשל: ספונסר, פרומו)' : 'Select type (e.g., Sponsor, Promo)'}</li>
                <li>{isRTL ? 'הגדירו טווח תאריכים ועדיפות' : 'Set date range and priority'}</li>
              </ul>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold">2</span>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'הוספת תוכן' : 'Add Content'}</h4>
              <ul className="list-disc list-inside text-dark-300 text-sm mt-1 space-y-1">
                <li>{isRTL ? 'לחצו "הוסף תוכן"' : 'Click "Add Content"'}</li>
                <li>{isRTL ? 'בחרו מהספרייה או העלו חדש' : 'Select from library or upload new'}</li>
                <li>{isRTL ? 'הוסיפו מספר קבצים לרוטציה' : 'Add multiple files for rotation'}</li>
              </ul>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'הגדרת רשת התזמון' : 'Configure Schedule Grid'}</h4>
              <p className="text-dark-300 text-sm mt-1">
                {isRTL
                  ? 'הרשת מציגה את כל השבוע ב-48 משבצות (חצי שעה כל אחת). לחצו על תא להגדלת מספר ההשמעות.'
                  : 'The grid shows the whole week in 48 slots (half hour each). Click a cell to increase play count.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Grid size={20} className="text-primary-400" />
          {isRTL ? 'רשת התזמון' : 'Schedule Grid'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'רשת התזמון היא מפת חום המציגה מתי הקמפיין ינגן:'
            : 'The schedule grid is a heatmap showing when the campaign plays:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'עמודות = ימים בשבוע (ראשון-שבת)' : 'Columns = Days of week (Sun-Sat)'}</li>
          <li>{isRTL ? 'שורות = משבצות זמן של 30 דקות (00:00-23:30)' : 'Rows = 30-minute time slots (00:00-23:30)'}</li>
          <li>{isRTL ? 'צבע התא = מספר השמעות (כהה יותר = יותר השמעות)' : 'Cell color = Play count (darker = more plays)'}</li>
        </ul>

        <HelpScreenshot
          src="/help/Campaign-Manager.jpg"
          alt="Schedule grid"
          caption="The schedule heatmap grid"
          captionHe="רשת מפת החום לתזמון"
        />

        <div className="p-3 rounded-lg bg-dark-800/50 border border-white/5 mt-4">
          <p className="text-sm text-dark-300">
            <strong className="text-dark-100">{isRTL ? 'שימוש ברשת:' : 'Using the grid:'}</strong>
            <br />
            {isRTL
              ? '• לחיצה על תא - הגדלת מספר ההשמעות\n• לחיצה ימנית - הקטנה\n• גרירה - בחירת טווח'
              : '• Click a cell - Increase play count\n• Right-click - Decrease\n• Drag - Select a range'}
          </p>
        </div>
      </div>

      {/* Jingles */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Mic size={20} className="text-primary-400" />
          {isRTL ? "הגדרות ג'ינגל" : 'Jingle Settings'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? "הוסיפו ג'ינגלי פתיחה וסגירה לעטוף את הפרסומות:"
            : 'Add opening/closing jingles to wrap your commercials:'}
        </p>

        <HelpScreenshot
          src="/help/Campaign-Manager.jpg"
          alt="Jingle settings"
          caption="Opening and closing jingle configuration"
          captionHe="הגדרת ג'ינגלי פתיחה וסגירה"
        />

        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li><strong>{isRTL ? "ג'ינגל פתיחה" : 'Opening Jingle'}</strong> - {isRTL ? 'מתנגן לפני הפרסומות' : 'Plays before commercials'}</li>
          <li><strong>{isRTL ? "ג'ינגל סגירה" : 'Closing Jingle'}</strong> - {isRTL ? 'מתנגן אחרי הפרסומות' : 'Plays after commercials'}</li>
          <li>{isRTL ? 'ניתן להפעיל/לכבות כל אחד בנפרד' : 'Each can be enabled/disabled independently'}</li>
        </ul>
      </div>

      {/* Scheduled Slots */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Calendar size={20} className="text-primary-400" />
          {isRTL ? 'משבצות מתוזמנות' : 'Scheduled Slots'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'פאנל המשבצות מציג את ההשמעות הקרובות:'
            : 'The slots panel shows upcoming plays:'}
        </p>

        <HelpScreenshot
          src="/help/Campaign-Manager.jpg"
          alt="Scheduled slots"
          caption="View upcoming scheduled plays"
          captionHe="צפייה בהשמעות מתוזמנות קרובות"
        />
      </div>

      {/* Run Now */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Play size={20} className="text-primary-400" />
          {isRTL ? 'הפעלה עכשיו' : 'Run Now'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'לחצו "הפעל עכשיו" כדי לבדוק משבצת מיד:'
            : 'Click "Run Now" to test a slot immediately:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'הפרסומות נכנסות לתור הנגן' : 'Commercials queue to the player'}</li>
          <li>{isRTL ? 'לא נספר כהשמעה מתוזמנת' : 'Does NOT count against scheduled plays'}</li>
          <li>{isRTL ? 'מושלם לבדיקות' : 'Perfect for testing'}</li>
        </ul>
      </div>

      {/* Advanced Features */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'תכונות מתקדמות' : 'Advanced Features'}
        </h3>

        <div className="grid gap-3">
          {/* Copy from Previous Week */}
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Copy size={18} className="text-blue-400" />
              </div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'העתקה מהשבוע הקודם' : 'Copy from Previous Week'}
              </h4>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'לחצו על "העתק מהשבוע הקודם" כדי להעתיק את לוח התזמון של השבוע הקודם לשבוע הנוכחי. חוסך זמן בהגדרת קמפיינים חוזרים.'
                : 'Click "Copy from Previous Week" to duplicate last week\'s schedule to the current week. Saves time setting up recurring campaigns.'}
            </p>
          </div>

          {/* Campaign Cloning */}
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Copy size={18} className="text-purple-400" />
              </div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'שכפול קמפיין' : 'Campaign Cloning'}
              </h4>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'לחצו על כפתור השכפול ליד כל קמפיין ליצירת עותק. שימושי ליצירת גרסאות דומות עם שינויים קטנים.'
                : 'Click the clone button next to any campaign to create a copy. Useful for creating similar versions with minor changes.'}
            </p>
          </div>

          {/* Bulk Save */}
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Save size={18} className="text-emerald-400" />
              </div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'שמירה מרובה' : 'Bulk Save'}
              </h4>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'כאשר יש שינויים במספר קמפיינים, לחצו "שמור הכל" לשמירת כולם בבת אחת. אזהרה צהובה תופיע כאשר יש שינויים שלא נשמרו.'
                : 'When multiple campaigns have changes, click "Save All" to save them all at once. A yellow warning appears when there are unsaved changes.'}
            </p>
          </div>

          {/* Slot Execution Status */}
          <div className="p-4 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <CheckCircle size={18} className="text-amber-400" />
              </div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'סטטוס ביצוע משבצות' : 'Slot Execution Status'}
              </h4>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'רשת התזמון מציגה אייקונים המסמנים אם משבצות הושמעו בהצלחה, נכשלו, או עדיין ממתינות.'
                : 'The schedule grid displays icons indicating whether slots were successfully played, failed, or are still pending.'}
            </p>
            <div className="flex gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle size={12} className="text-emerald-400" />
                <span className="text-dark-400">{isRTL ? 'הושמע' : 'Played'}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle size={12} className="text-red-400" />
                <span className="text-dark-400">{isRTL ? 'נכשל' : 'Failed'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-dark-400" />
                <span className="text-dark-400">{isRTL ? 'ממתין' : 'Pending'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Status */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'סטטוס קמפיין' : 'Campaign Status'}
        </h3>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <div>
              <span className="font-medium text-emerald-400">{isRTL ? 'פעיל' : 'Active'}</span>
              <p className="text-xs text-dark-400">{isRTL ? 'רץ לפי התזמון' : 'Running on schedule'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <div>
              <span className="font-medium text-yellow-400">{isRTL ? 'מושהה' : 'Paused'}</span>
              <p className="text-xs text-dark-400">{isRTL ? 'עצור זמנית' : 'Temporarily stopped'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-dark-700/50 border border-white/5">
            <span className="w-3 h-3 rounded-full bg-dark-400"></span>
            <div>
              <span className="font-medium text-dark-300">{isRTL ? 'טיוטה' : 'Draft'}</span>
              <p className="text-xs text-dark-400">{isRTL ? 'עדיין לא הופעל' : 'Not yet activated'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-dark-700/50 border border-white/5">
            <span className="w-3 h-3 rounded-full bg-dark-500"></span>
            <div>
              <span className="font-medium text-dark-300">{isRTL ? 'הושלם' : 'Completed'}</span>
              <p className="text-xs text-dark-400">{isRTL ? 'עבר תאריך סיום' : 'Past end date'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Important Note */}
      <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-400 mb-1">
              {isRTL ? 'חשוב לדעת' : 'Important'}
            </h4>
            <p className="text-dark-300 text-sm">
              {isRTL
                ? 'קמפיינים עם עדיפות גבוהה יותר מתנגנים קודם באותה משבצת. ודאו שעדיפויות הספונסרים הפרימיום גבוהות יותר.'
                : 'Campaigns with higher priority play first in the same slot. Make sure premium sponsors have higher priorities.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
