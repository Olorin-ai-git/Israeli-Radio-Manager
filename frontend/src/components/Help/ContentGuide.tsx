import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Music, Radio, Megaphone, Mic, FileAudio, Newspaper, RefreshCw, HardDrive, MousePointer2, ArrowUpDown, Sparkles, CheckSquare } from 'lucide-react'

export default function ContentGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  const contentTypes = [
    { icon: Music, name: 'Songs', nameHe: 'שירים', desc: 'Music tracks for regular playback', descHe: 'רצועות מוזיקה להשמעה רגילה', color: 'text-primary-400', bg: 'bg-primary-500/20' },
    { icon: Radio, name: 'Shows', nameHe: 'תוכניות', desc: 'Recorded shows and programs', descHe: 'תוכניות ומשדרים מוקלטים', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { icon: Megaphone, name: 'Commercials', nameHe: 'פרסומות', desc: 'Ads and sponsored content', descHe: 'פרסומות ותוכן ממומן', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { icon: Mic, name: 'Jingles', nameHe: "ג'ינגלים", desc: 'Station IDs and jingles', descHe: "זיהויי תחנה וג'ינגלים", color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { icon: Newspaper, name: 'Newsflashes', nameHe: 'חדשות בזק', desc: 'Breaking news and updates', descHe: 'חדשות בזק ועדכונים', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { icon: FileAudio, name: 'Samples', nameHe: 'סמפלים', desc: 'Audio samples and effects', descHe: 'דגימות ואפקטים', color: 'text-pink-400', bg: 'bg-pink-500/20' },
  ]

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'ניהול התוכן הוא המקום להעלות, לארגן ולנהל את כל קבצי האודיו שלכם.'
          : 'Content Management is where you upload, organize, and manage all your audio files.'}
      </p>

      <HelpScreenshot
        src="/help/Library.jpg"
        alt="Content library"
        caption="The content library overview"
        captionHe="סקירת ספריית התוכן"
      />

      {/* Content Types */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'סוגי תוכן' : 'Content Types'}
        </h3>
        <p className="text-dark-300 mb-4">
          {isRTL
            ? 'המערכת תומכת במספר סוגי תוכן:'
            : 'The system supports several content types:'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {contentTypes.map((type) => {
            const Icon = type.icon
            return (
              <div key={type.name} className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
                <div className={`p-2 rounded-lg ${type.bg}`}>
                  <Icon size={18} className={type.color} />
                </div>
                <div>
                  <h4 className="font-medium text-dark-100">
                    {isRTL ? type.nameHe : type.name}
                  </h4>
                  <p className="text-xs text-dark-400">
                    {isRTL ? type.descHe : type.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Uploading */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'העלאת תוכן' : 'Uploading Content'}
        </h3>
        <ol className="list-decimal list-inside text-dark-300 space-y-2 mr-4">
          <li>{isRTL ? 'לחצו על "העלאה" בתפריט או גררו קבצים לאזור ההעלאה' : 'Click "Upload" in the menu or drag files to the upload area'}</li>
          <li>{isRTL ? 'בחרו קבצים (MP3, WAV, FLAC, M4A, AAC, OGG נתמכים)' : 'Select files (MP3, WAV, FLAC, M4A, AAC, OGG supported)'}</li>
          <li>{isRTL ? 'הגדירו מטא-דאטה: שם, אמן, סוג' : 'Set metadata: title, artist, type'}</li>
          <li>{isRTL ? 'לחצו "העלה" ולהמתין להשלמה' : 'Click "Upload" and wait for completion'}</li>
        </ol>

        <HelpScreenshot
          src="/help/Upload.jpg"
          alt="Upload interface"
          caption="The upload dialog"
          captionHe="חלון ההעלאה"
        />
      </div>

      {/* AI Auto-Categorization */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Sparkles size={20} className="text-amber-400" />
          {isRTL ? 'סיווג אוטומטי עם AI' : 'AI Auto-Categorization'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'המערכת משתמשת בבינה מלאכותית לסיווג אוטומטי של קבצים שהועלו:'
            : 'The system uses AI to automatically categorize uploaded files:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'זיהוי אוטומטי של סוג התוכן (שיר, תוכנית, פרסומת)' : 'Automatic detection of content type (song, show, commercial)'}</li>
          <li>{isRTL ? 'הצעות לז\'אנר ושפה' : 'Suggestions for genre and language'}</li>
          <li>{isRTL ? 'חילוץ מטא-דאטה מהקובץ' : 'Metadata extraction from the file'}</li>
        </ul>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-400">
            {isRTL
              ? 'קבצים בהמתנה לסיווג מופיעים בתור "ממתינים לסיווג" - תוכלו לאשר, לערוך או לדחות את ההצעות.'
              : 'Files pending categorization appear in "Pending Categorization" queue - you can approve, edit, or reject the suggestions.'}
          </p>
        </div>
      </div>

      {/* Managing Content */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'ניהול תוכן' : 'Managing Content'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'בספריית התוכן תוכלו:'
            : 'In the content library you can:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'לחפש לפי שם, אמן או סוג' : 'Search by title, artist, or type'}</li>
          <li>{isRTL ? 'לסנן לפי סוג תוכן באמצעות הטאבים' : 'Filter by content type using tabs'}</li>
          <li>{isRTL ? 'לערוך מטא-דאטה ישירות בטבלה (לחיצה על פריט)' : 'Edit metadata inline (click on an item)'}</li>
          <li>{isRTL ? 'להאזין לתצוגה מקדימה' : 'Listen to a preview'}</li>
          <li>{isRTL ? 'למחוק תוכן שאינו בשימוש' : 'Delete unused content'}</li>
        </ul>
      </div>

      {/* Advanced Library Features */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'תכונות מתקדמות' : 'Advanced Features'}
        </h3>

        <div className="grid gap-3">
          {/* Bulk Selection */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <CheckSquare size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'בחירה מרובה' : 'Bulk Selection'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'בחרו מספר פריטים והוסיפו אותם לתור בלחיצה אחת' : 'Select multiple items and add them to the queue in one click'}
              </p>
            </div>
          </div>

          {/* Column Sorting */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <ArrowUpDown size={18} className="text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'מיון עמודות' : 'Column Sorting'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'לחצו על כותרת עמודה למיון לפי שם, ז\'אנר, משך זמן או תאריך הוספה' : 'Click column headers to sort by title, genre, duration, or date added'}
              </p>
            </div>
          </div>

          {/* Google Drive Sync */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <HardDrive size={18} className="text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'סנכרון עם Google Drive' : 'Google Drive Sync'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'לחצו על כפתור הסנכרון לייבוא קבצים ישירות מ-Google Drive' : 'Click the sync button to import files directly from Google Drive'}
              </p>
            </div>
          </div>

          {/* Metadata Refresh */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <RefreshCw size={18} className="text-purple-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'רענון מטא-דאטה' : 'Metadata Refresh'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'לחצו על כפתור הרענון לעדכון מטא-דאטה מהקבצים המקוריים' : 'Click the refresh button to update metadata from the original files'}
              </p>
            </div>
          </div>

          {/* Inline Editing */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <MousePointer2 size={18} className="text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">
                {isRTL ? 'עריכה בטבלה' : 'Inline Editing'}
              </h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'לחצו על פריט לפתיחת חלון עריכה לעדכון שם, אמן וז\'אנר' : 'Click on an item to open the edit panel to update title, artist, and genre'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Info */}
      <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-white/5">
        <h4 className="font-semibold text-dark-100 mb-2">
          {isRTL ? 'אחסון בענן' : 'Cloud Storage'}
        </h4>
        <p className="text-dark-300 text-sm">
          {isRTL
            ? 'כל הקבצים נשמרים ב-Google Cloud Storage לגיבוי ואמינות. הקבצים מוזרמים ישירות מהענן לנגן.'
            : 'All files are stored in Google Cloud Storage for backup and reliability. Files stream directly from the cloud to the player.'}
        </p>
      </div>
    </div>
  )
}
