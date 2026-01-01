import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Play, SkipForward, Volume2, ListMusic } from 'lucide-react'

export default function DashboardGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'לוח הבקרה הוא המרכז העיקרי שלכם. כאן תוכלו לשלוט בהשמעה, לראות את התור ולנהל את הסטטוס הכללי.'
          : 'The dashboard is your central hub. Here you can control playback, see the queue, and manage overall status.'}
      </p>

      <HelpScreenshot
        src="/help/Dashboard.jpg"
        alt="Dashboard overview"
        caption="The main dashboard view"
        captionHe="תצוגת לוח הבקרה הראשית"
      />

      {/* Audio Player */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'נגן האודיו' : 'Audio Player'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'הנגן נמצא בתחתית המסך ומספק שליטה מלאה בהשמעה:'
            : 'The player is at the bottom of the screen and provides full playback control:'}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50">
            <div className="p-2 rounded-lg bg-dark-700">
              <Play size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'נגן / השהה' : 'Play / Pause'}</h4>
              <p className="text-sm text-dark-400">{isRTL ? 'התחל או עצור את ההשמעה' : 'Start or stop playback'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50">
            <div className="p-2 rounded-lg bg-dark-700">
              <SkipForward size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'דלג' : 'Skip'}</h4>
              <p className="text-sm text-dark-400">{isRTL ? 'עבור לפריט הבא' : 'Move to the next item'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50">
            <div className="p-2 rounded-lg bg-dark-700">
              <Volume2 size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'עוצמה' : 'Volume'}</h4>
              <p className="text-sm text-dark-400">{isRTL ? 'כוונן את עוצמת השמע' : 'Adjust audio volume'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-dark-800/50">
            <div className="p-2 rounded-lg bg-dark-700">
              <ListMusic size={18} className="text-primary-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'תור' : 'Queue'}</h4>
              <p className="text-sm text-dark-400">{isRTL ? 'צפה בפריטים הבאים' : 'View upcoming items'}</p>
            </div>
          </div>
        </div>

        <HelpScreenshot
          src="/help/Dashboard.jpg"
          alt="Audio player controls"
          caption="Player controls and track info"
          captionHe="פקדי הנגן ומידע על הרצועה"
        />
      </div>

      {/* Queue Panel */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'תור ההשמעה' : 'Playback Queue'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'התור מציג את כל הפריטים שימוגנו לאחר הרצועה הנוכחית. תוכלו לראות:'
            : 'The queue shows all items that will play after the current track. You can see:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'שם ואמן' : 'Title and artist'}</li>
          <li>{isRTL ? 'סוג התוכן (שיר, פרסומת, ג\'ינגל וכו\')' : 'Content type (song, commercial, jingle, etc.)'}</li>
          <li>{isRTL ? 'משך זמן' : 'Duration'}</li>
        </ul>

        <HelpScreenshot
          src="/help/Suggested.jpg"
          alt="Queue panel"
          caption="The playback queue shows what's next"
          captionHe="תור ההשמעה מציג מה יתנגן הלאה"
        />
      </div>

      {/* Now Playing */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'מתנגן עכשיו' : 'Now Playing'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'אזור "מתנגן עכשיו" מציג מידע על הרצועה הנוכחית כולל:'
            : 'The "Now Playing" area shows information about the current track including:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'שם הרצועה והאמן' : 'Track title and artist'}</li>
          <li>{isRTL ? 'סרגל התקדמות' : 'Progress bar'}</li>
          <li>{isRTL ? 'זמן שעבר / זמן כולל' : 'Elapsed / total time'}</li>
          <li>{isRTL ? 'תמונת אלבום (אם זמינה)' : 'Album artwork (if available)'}</li>
        </ul>
      </div>

      {/* Status Indicators */}
      <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-white/5">
        <h4 className="font-semibold text-dark-100 mb-3">
          {isRTL ? 'מחווני סטטוס' : 'Status Indicators'}
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-dark-300">{isRTL ? 'ירוק - מערכת פעילה' : 'Green - System active'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span className="text-dark-300">{isRTL ? 'צהוב - יש התראות' : 'Yellow - Warnings present'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span className="text-dark-300">{isRTL ? 'אדום - שגיאה' : 'Red - Error'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
