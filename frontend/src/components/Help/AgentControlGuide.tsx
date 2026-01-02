import { useTranslation } from 'react-i18next'
import { Bot, Zap, Hand, Check, X, Clock, AlertCircle, FileText } from 'lucide-react'

export default function AgentControlGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'עמוד בקרת הסוכן מאפשר לכם לשלוט במערכת האוטומציה החכמה. הסוכן יכול לקבל החלטות באופן עצמאי או לבקש את אישורכם.'
          : 'The Agent Control page lets you manage the intelligent automation system. The agent can make decisions autonomously or request your approval.'}
      </p>

      {/* Automation Modes */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Bot size={20} className="text-primary-400" />
          {isRTL ? 'מצבי אוטומציה' : 'Automation Modes'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'המערכת מציעה שני מצבי פעולה:'
            : 'The system offers two operation modes:'}
        </p>

        <div className="grid gap-4 mt-4">
          {/* Full Automation */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary-500/10 to-emerald-500/10 border border-primary-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary-500/20">
                <Zap size={20} className="text-primary-400" />
              </div>
              <div>
                <h4 className="font-semibold text-dark-100">
                  {isRTL ? 'אוטומציה מלאה' : 'Full Automation'}
                </h4>
                <span className="text-xs text-primary-400">
                  {isRTL ? '24/7 ללא התערבות' : '24/7 hands-free'}
                </span>
              </div>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'הסוכן מקבל את כל ההחלטות באופן עצמאי ללא התערבות אנושית. מתאים לשידור רציף ואוטומטי.'
                : 'The agent makes all decisions autonomously without human intervention. Ideal for continuous, automated broadcasting.'}
            </p>
            <ul className="mt-3 text-sm text-dark-400 space-y-1">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                {isRTL ? 'בחירת שירים אוטומטית' : 'Automatic song selection'}
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                {isRTL ? 'תזמון פרסומות אוטומטי' : 'Automatic commercial scheduling'}
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                {isRTL ? 'מעברים חלקים בין תוכניות' : 'Smooth transitions between shows'}
              </li>
            </ul>
          </div>

          {/* Prompt Mode */}
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Hand size={20} className="text-amber-400" />
              </div>
              <div>
                <h4 className="font-semibold text-dark-100">
                  {isRTL ? 'מצב אישור' : 'Prompt Mode'}
                </h4>
                <span className="text-xs text-amber-400">
                  {isRTL ? 'אתם מאשרים' : 'You approve'}
                </span>
              </div>
            </div>
            <p className="text-sm text-dark-400">
              {isRTL
                ? 'הסוכן מבקש אישור לפעולות מסוימות לפני ביצוען. אתם שומרים על שליטה בהחלטות חשובות.'
                : 'The agent requests confirmation for certain actions before executing. You maintain control over important decisions.'}
            </p>
            <ul className="mt-3 text-sm text-dark-400 space-y-1">
              <li className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400" />
                {isRTL ? 'בחירת תוכניות - דורש אישור' : 'Show selection - requires approval'}
              </li>
              <li className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400" />
                {isRTL ? 'שינויי לוח זמנים - דורש אישור' : 'Schedule changes - requires approval'}
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-emerald-400" />
                {isRTL ? 'בחירת שירים - אוטומטי' : 'Song selection - automatic'}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Clock size={20} className="text-amber-400" />
          {isRTL ? 'פעולות ממתינות' : 'Pending Actions'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'במצב אישור, הפעולות הממתינות מופיעות ברשימה. לכל פעולה תוכלו:'
            : 'In Prompt Mode, pending actions appear in a list. For each action you can:'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <Check size={24} className="text-emerald-400 mx-auto mb-2" />
            <h4 className="font-medium text-dark-100">{isRTL ? 'אשר' : 'Approve'}</h4>
            <p className="text-xs text-dark-400">
              {isRTL ? 'הפעולה תתבצע' : 'Action will execute'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <X size={24} className="text-red-400 mx-auto mb-2" />
            <h4 className="font-medium text-dark-100">{isRTL ? 'דחה' : 'Reject'}</h4>
            <p className="text-xs text-dark-400">
              {isRTL ? 'הפעולה תבוטל' : 'Action will be cancelled'}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-400">
            {isRTL
              ? 'שימו לב: לפעולות ממתינות יש זמן תפוגה. אם לא תגיבו בזמן, הן יפוגו אוטומטית.'
              : 'Note: Pending actions have an expiration time. If you don\'t respond in time, they expire automatically.'}
          </p>
        </div>
      </div>

      {/* Decision Log */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <FileText size={20} className="text-purple-400" />
          {isRTL ? 'יומן החלטות' : 'Decision Log'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'יומן ההחלטות מציג את כל הפעולות שהסוכן ביצע או הציע. תוכלו לראות:'
            : 'The decision log shows all actions the agent has taken or proposed. You can see:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'זמן הפעולה' : 'Action timestamp'}</li>
          <li>{isRTL ? 'סוג הפעולה' : 'Action type'}</li>
          <li>{isRTL ? 'הנמקת הסוכן' : 'Agent\'s reasoning'}</li>
          <li>{isRTL ? 'תוצאה (בוצע/נדחה/פג תוקף)' : 'Result (executed/rejected/expired)'}</li>
        </ul>
      </div>

      {/* Status Panel */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'פאנל סטטוס' : 'Status Panel'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'בצד ימין תמצאו את פאנל הסטטוס המציג:'
            : 'On the right side you\'ll find the status panel showing:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'סטטוס הסוכן (פעיל/לא פעיל)' : 'Agent status (active/inactive)'}</li>
          <li>{isRTL ? 'מצב נוכחי (אוטומציה מלאה/אישור)' : 'Current mode (full automation/prompt)'}</li>
          <li>{isRTL ? 'פעולות ממתינות' : 'Pending actions count'}</li>
          <li>{isRTL ? 'החלטות היום' : 'Decisions today'}</li>
        </ul>
      </div>

      {/* Best Practices */}
      <div className="mt-6 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h4 className="font-semibold text-primary-400 mb-2">
          {isRTL ? 'המלצות' : 'Best Practices'}
        </h4>
        <ul className="text-dark-300 text-sm space-y-1">
          <li>
            {isRTL
              ? '• התחילו במצב אישור כדי ללמוד את התנהגות הסוכן'
              : '• Start with Prompt Mode to learn the agent\'s behavior'}
          </li>
          <li>
            {isRTL
              ? '• עברו לאוטומציה מלאה לאחר שאתם מרוצים מההחלטות'
              : '• Switch to Full Automation once you\'re satisfied with decisions'}
          </li>
          <li>
            {isRTL
              ? '• בדקו את יומן ההחלטות באופן קבוע'
              : '• Review the decision log regularly'}
          </li>
        </ul>
      </div>
    </div>
  )
}
