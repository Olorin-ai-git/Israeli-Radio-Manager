import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'

export default function QuickStartGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'ברוכים הבאים למערכת ניהול הרדיו! מדריך זה יעזור לכם להתחיל במהירות.'
          : 'Welcome to the Radio Management System! This guide will help you get started quickly.'}
      </p>

      {/* Step 1 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold">1</span>
          {isRTL ? 'הכירו את לוח הבקרה' : 'Get to Know the Dashboard'}
        </h3>
        <p className="text-dark-300 mr-9">
          {isRTL
            ? 'לוח הבקרה הוא הבסיס שלכם. כאן תראו את הרצועה המתנגנת כעת, תור ההשמעה ופעולות מהירות.'
            : 'The dashboard is your home base. Here you\'ll see the current track, playback queue, and quick actions.'}
        </p>
        <div className="mr-9">
          <HelpScreenshot
            src="/help/Dashboard.jpg"
            alt="Dashboard overview"
            caption="Main dashboard with player and queue"
            captionHe="לוח הבקרה עם הנגן ותור ההשמעה"
          />
        </div>
      </div>

      {/* Step 2 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold">2</span>
          {isRTL ? 'צרו את הזרימה הראשונה שלכם' : 'Create Your First Flow'}
        </h3>
        <p className="text-dark-300 mr-9">
          {isRTL
            ? '"זרימה" היא רצף של פעולות שרצות אוטומטית. לכו לסטודיו פעולות, צרו זרימה חדשה, גררו בלוקים מהפלטה והגדירו לוח זמנים.'
            : 'A "Flow" is a sequence of actions that run automatically. Go to Actions Studio, create a new flow, drag blocks from the palette, and set your schedule.'}
        </p>
        <div className="mr-9">
          <HelpScreenshot
            src="/help/Actions-Studio.jpg"
            alt="Actions Studio"
            caption="Create flows with drag-and-drop blocks"
            captionHe="צרו זרימות עם גרירה ושחרור של בלוקים"
          />
        </div>
      </div>

      {/* Step 3 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold">3</span>
          {isRTL ? 'הוסיפו תוכן' : 'Add Your Content'}
        </h3>
        <p className="text-dark-300 mr-9">
          {isRTL
            ? 'העלו את קבצי האודיו שלכם: לכו לניהול תוכן, לחצו על "העלאה", בחרו קבצים והגדירו מטא-דאטה.'
            : 'Upload your audio files: Go to Manage Content, click "Upload", select files, and set metadata.'}
        </p>
        <div className="mr-9">
          <HelpScreenshot
            src="/help/Upload.jpg"
            alt="Upload content"
            caption="Upload and organize your audio files"
            captionHe="העלו וסדרו את קבצי האודיו שלכם"
          />
        </div>
      </div>

      {/* Step 4 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold">4</span>
          {isRTL ? 'תזמנו קמפיינים' : 'Schedule Campaigns'}
        </h3>
        <p className="text-dark-300 mr-9">
          {isRTL
            ? 'להפסקות פרסומת: לכו למנהל קמפיינים, צרו קמפיין עם הפרסומות שלכם, הגדירו את רשת הזמנים והפעילו.'
            : 'For commercial breaks: Go to Campaign Manager, create a campaign with your ads, set the schedule grid, and activate.'}
        </p>
        <div className="mr-9">
          <HelpScreenshot
            src="/help/Campaign-Manager.jpg"
            alt="Campaign Manager"
            caption="Schedule your advertising campaigns"
            captionHe="תזמנו את הקמפיינים הפרסומיים שלכם"
          />
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h4 className="font-semibold text-primary-400 mb-2">
          {isRTL ? 'טיפ מהיר' : 'Quick Tip'}
        </h4>
        <p className="text-dark-300 text-sm mb-4">
          {isRTL
            ? 'השתמשו בלחצן "דבר עם הסוכן" בסרגל הצד לקבלת עזרה מיידית. הסוכן יכול לענות על שאלות ולעזור בביצוע פעולות.'
            : 'Use the "Chat with Agent" button in the sidebar for immediate help. The agent can answer questions and assist with tasks.'}
        </p>
        <HelpScreenshot
          src="/help/Chat.jpg"
          alt="Chat with Agent"
          caption="Get instant help from the AI agent"
          captionHe="קבלו עזרה מיידית מהסוכן"
        />
      </div>

      {/* Hebrew Support */}
      <div className="mt-6 p-4 rounded-xl bg-dark-800/50 border border-white/5">
        <h4 className="font-semibold text-dark-100 mb-2">
          {isRTL ? 'תמיכה בעברית' : 'Hebrew Support'}
        </h4>
        <p className="text-dark-300 text-sm mb-4">
          {isRTL
            ? 'המערכת תומכת במלואה בעברית. עברו להגדרות לשינוי שפה.'
            : 'The system fully supports Hebrew. Go to Settings to change the language.'}
        </p>
        <HelpScreenshot
          src="/help/Hebrew.jpg"
          alt="Hebrew interface"
          caption="Full RTL Hebrew support"
          captionHe="תמיכה מלאה בעברית מימין לשמאל"
        />
      </div>
    </div>
  )
}
