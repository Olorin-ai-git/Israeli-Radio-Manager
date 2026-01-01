import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Music, Radio, Megaphone, Mic, FileAudio, Speaker } from 'lucide-react'

export default function ContentGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  const contentTypes = [
    { icon: Music, name: 'Songs', nameHe: 'שירים', desc: 'Music tracks for regular playback', descHe: 'רצועות מוזיקה להשמעה רגילה', color: 'text-primary-400', bg: 'bg-primary-500/20' },
    { icon: Radio, name: 'Shows', nameHe: 'תוכניות', desc: 'Recorded shows and programs', descHe: 'תוכניות ומשדרים מוקלטים', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { icon: Megaphone, name: 'Commercials', nameHe: 'פרסומות', desc: 'Ads and sponsored content', descHe: 'פרסומות ותוכן ממומן', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { icon: Mic, name: 'Jingles', nameHe: "ג'ינגלים", desc: 'Station IDs and jingles', descHe: "זיהויי תחנה וג'ינגלים", color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { icon: Speaker, name: 'Bumpers', nameHe: 'באמפרים', desc: 'Short transitions', descHe: 'מעברים קצרים', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
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
          <li>{isRTL ? 'לחצו על "העלאה" בתפריט או בכפתור ההעלאה' : 'Click "Upload" in the menu or upload button'}</li>
          <li>{isRTL ? 'בחרו קבצים (MP3, WAV, FLAC נתמכים)' : 'Select files (MP3, WAV, FLAC supported)'}</li>
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
          <li>{isRTL ? 'לסנן לפי סוג תוכן' : 'Filter by content type'}</li>
          <li>{isRTL ? 'לערוך מטא-דאטה של פריט' : 'Edit item metadata'}</li>
          <li>{isRTL ? 'להאזין לתצוגה מקדימה' : 'Listen to a preview'}</li>
          <li>{isRTL ? 'למחוק תוכן שאינו בשימוש' : 'Delete unused content'}</li>
        </ul>
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
