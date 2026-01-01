import { useTranslation } from 'react-i18next'
import { Mail, Phone, MessageCircle, AlertCircle, Bug, Lightbulb } from 'lucide-react'
import HelpScreenshot from './HelpScreenshot'

export default function SupportSection() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'צריכים עזרה? אנחנו כאן בשבילכם. בחרו את דרך התמיכה המתאימה לכם.'
          : 'Need help? We\'re here for you. Choose the support option that works best.'}
      </p>

      {/* Contact Options */}
      <div className="grid gap-4">
        <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary-500/20">
              <MessageCircle size={24} className="text-primary-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-dark-100">
                {isRTL ? 'דבר עם הסוכן' : 'Chat with Agent'}
              </h3>
              <p className="text-dark-400 text-sm mt-1">
                {isRTL
                  ? 'לחצו על "דבר עם הסוכן" בסרגל הצד לקבלת עזרה מיידית. הסוכן יכול לענות על שאלות ולעזור בביצוע פעולות.'
                  : 'Click "Chat with Agent" in the sidebar for immediate help. The agent can answer questions and assist with tasks.'}
              </p>
              <p className="text-primary-400 text-sm mt-2 font-medium">
                {isRTL ? 'זמין 24/7' : 'Available 24/7'}
              </p>
            </div>
          </div>
          <HelpScreenshot
            src="/help/Agent.jpg"
            alt="AI Agent"
            caption="Configure and interact with the AI agent"
            captionHe="הגדירו ותקשרו עם הסוכן"
          />
        </div>

        <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/20">
            <Mail size={24} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-dark-100">
              {isRTL ? 'אימייל' : 'Email'}
            </h3>
            <p className="text-dark-400 text-sm mt-1">
              {isRTL
                ? 'לשאלות מורכבות או בקשות מיוחדות.'
                : 'For complex questions or special requests.'}
            </p>
            <a href="mailto:support@olorin.ai" className="text-emerald-400 text-sm mt-2 font-medium hover:underline block">
              support@olorin.ai
            </a>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/20">
            <Phone size={24} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-dark-100">
              {isRTL ? 'טלפון' : 'Phone'}
            </h3>
            <p className="text-dark-400 text-sm mt-1">
              {isRTL
                ? 'לבעיות דחופות הדורשות תמיכה מיידית.'
                : 'For urgent issues requiring immediate support.'}
            </p>
            <p className="text-dark-500 text-sm mt-2">
              {isRTL ? 'צרו קשר עם מנהל התחנה' : 'Contact your station manager'}
            </p>
          </div>
        </div>
      </div>

      {/* Common Issues */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'בעיות נפוצות' : 'Common Issues'}
        </h3>

        <div className="space-y-3">
          <details className="group p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <summary className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-dark-100">
                {isRTL ? 'הקמפיין שלי לא מתנגן' : 'My campaign isn\'t playing'}
              </span>
              <span className="text-dark-400 group-open:rotate-180 transition-transform">
                <AlertCircle size={18} />
              </span>
            </summary>
            <ol className="list-decimal list-inside text-dark-300 text-sm mt-3 space-y-1">
              <li>{isRTL ? 'ודאו שסטטוס הקמפיין הוא "פעיל"' : 'Check if campaign status is "Active"'}</li>
              <li>{isRTL ? 'ודאו שהזמן הנוכחי מתאים לרשת התזמון' : 'Verify current time matches schedule grid'}</li>
              <li>{isRTL ? 'בדקו עדיפות מול קמפיינים אחרים' : 'Check priority vs other campaigns'}</li>
              <li>{isRTL ? 'נסו "הפעל עכשיו" לבדיקה' : 'Try "Run Now" to test'}</li>
            </ol>
          </details>

          <details className="group p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <summary className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-dark-100">
                {isRTL ? 'התור ריק' : 'The queue is empty'}
              </span>
              <span className="text-dark-400 group-open:rotate-180 transition-transform">
                <AlertCircle size={18} />
              </span>
            </summary>
            <ol className="list-decimal list-inside text-dark-300 text-sm mt-3 space-y-1">
              <li>{isRTL ? 'בדקו אם זרימה מתוזמנת' : 'Check if a flow is scheduled'}</li>
              <li>{isRTL ? 'ודאו שלזרימה יש פעולות' : 'Verify flow has actions'}</li>
              <li>{isRTL ? 'בדקו זמינות תוכן' : 'Check content availability'}</li>
            </ol>
          </details>

          <details className="group p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <summary className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-dark-100">
                {isRTL ? 'בעיות באיכות האודיו' : 'Audio quality issues'}
              </span>
              <span className="text-dark-400 group-open:rotate-180 transition-transform">
                <AlertCircle size={18} />
              </span>
            </summary>
            <ol className="list-decimal list-inside text-dark-300 text-sm mt-3 space-y-1">
              <li>{isRTL ? 'בדקו את חיבור האינטרנט שלכם' : 'Check your internet connection'}</li>
              <li>{isRTL ? 'נסו לרענן את הדף' : 'Try refreshing the page'}</li>
              <li>{isRTL ? 'בדקו הגדרות אודיו בדפדפן' : 'Check browser audio settings'}</li>
            </ol>
          </details>

          <details className="group p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <summary className="flex items-center justify-between cursor-pointer">
              <span className="font-medium text-dark-100">
                {isRTL ? 'לא מצליח להעלות קבצים' : 'Cannot upload files'}
              </span>
              <span className="text-dark-400 group-open:rotate-180 transition-transform">
                <AlertCircle size={18} />
              </span>
            </summary>
            <ol className="list-decimal list-inside text-dark-300 text-sm mt-3 space-y-1">
              <li>{isRTL ? 'ודאו שהקובץ בפורמט נתמך (MP3, WAV, FLAC)' : 'Verify file is in supported format (MP3, WAV, FLAC)'}</li>
              <li>{isRTL ? 'בדקו שגודל הקובץ סביר (עד 100MB)' : 'Check file size is reasonable (up to 100MB)'}</li>
              <li>{isRTL ? 'נסו קובץ אחר לבדיקה' : 'Try a different file to test'}</li>
            </ol>
          </details>
        </div>
      </div>

      {/* Feedback */}
      <div className="mt-8 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <div className="flex items-start gap-3">
          <Lightbulb size={24} className="text-primary-400 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-primary-400 mb-1">
              {isRTL ? 'יש לכם רעיון או הצעה?' : 'Have an idea or suggestion?'}
            </h4>
            <p className="text-dark-300 text-sm">
              {isRTL
                ? 'אנחנו תמיד שמחים לשמוע מכם! שלחו משוב, רעיונות לשיפור או דיווחי באגים.'
                : 'We love hearing from you! Send feedback, improvement ideas, or bug reports.'}
            </p>
            <a
              href="mailto:feedback@olorin.ai"
              className="inline-flex items-center gap-2 mt-3 text-primary-400 hover:text-primary-300 text-sm font-medium"
            >
              <Mail size={16} />
              feedback@olorin.ai
            </a>
          </div>
        </div>
      </div>

      {/* Report a Bug */}
      <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
        <div className="flex items-start gap-3">
          <Bug size={24} className="text-red-400 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-dark-100 mb-1">
              {isRTL ? 'דיווח על באג' : 'Report a Bug'}
            </h4>
            <p className="text-dark-400 text-sm">
              {isRTL
                ? 'מצאתם משהו שלא עובד כמו שצריך? עזרו לנו לשפר על ידי דיווח מפורט.'
                : 'Found something not working as expected? Help us improve by reporting with details.'}
            </p>
            <p className="text-dark-500 text-xs mt-2">
              {isRTL
                ? 'כללו: מה ניסיתם לעשות, מה קרה, מה ציפיתם שיקרה.'
                : 'Include: what you tried, what happened, what you expected.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
