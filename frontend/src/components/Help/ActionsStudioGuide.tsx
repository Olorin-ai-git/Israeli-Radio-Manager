import { useTranslation } from 'react-i18next'
import HelpScreenshot from './HelpScreenshot'
import { Music, Play, Megaphone, Radio, Mic, Clock, Volume2, MessageSquare } from 'lucide-react'

export default function ActionsStudioGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  const blockTypes = [
    { icon: Music, name: 'play_song', nameHe: 'נגן שיר', desc: 'Play a random song', descHe: 'נגן שיר אקראי' },
    { icon: Play, name: 'play_content', nameHe: 'נגן תוכן', desc: 'Play specific content', descHe: 'נגן תוכן ספציפי' },
    { icon: Megaphone, name: 'play_scheduled_commercials', nameHe: 'נגן פרסומות', desc: 'Play campaign ads', descHe: 'נגן פרסומות מקמפיינים' },
    { icon: Radio, name: 'play_show', nameHe: 'נגן תוכנית', desc: 'Play scheduled show', descHe: 'נגן תוכנית מתוזמנת' },
    { icon: Mic, name: 'play_jingle', nameHe: "נגן ג'ינגל", desc: 'Play jingle or bumper', descHe: "נגן ג'ינגל או באמפר" },
    { icon: MessageSquare, name: 'play_tts', nameHe: 'טקסט לדיבור', desc: 'Text-to-speech announcement', descHe: 'הכרזה בטקסט לדיבור' },
    { icon: Clock, name: 'wait', nameHe: 'המתן', desc: 'Pause between actions', descHe: 'השהה בין פעולות' },
    { icon: Volume2, name: 'set_volume', nameHe: 'כוון עוצמה', desc: 'Adjust playback volume', descHe: 'כוון עוצמת השמעה' },
  ]

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'סטודיו הפעולות מאפשר לכם ליצור "זרימות" - רצפי פעולות שרצים אוטומטית. זו הדרך העיקרית להפוך את לוח השידורים שלכם לאוטומטי.'
          : 'Actions Studio lets you create "Flows" - sequences of actions that run automatically. This is the main way to automate your broadcast schedule.'}
      </p>

      <HelpScreenshot
        src="/help/Actions-Studio.jpg"
        alt="Actions Studio overview"
        caption="The Actions Studio interface"
        captionHe="ממשק סטודיו הפעולות"
      />

      {/* Creating a Flow */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'יצירת זרימה חדשה' : 'Creating a New Flow'}
        </h3>
        <ol className="list-decimal list-inside text-dark-300 space-y-2 mr-4">
          <li>{isRTL ? 'לחצו על "זרימה חדשה" או "+" בפאנל הזרימות' : 'Click "New Flow" or "+" in the Flows panel'}</li>
          <li>{isRTL ? 'תנו שם לזרימה (לדוגמה: "תוכנית בוקר")' : 'Give your flow a name (e.g., "Morning Show")'}</li>
          <li>{isRTL ? 'גררו בלוקים מהפלטה אל ציר הזמן' : 'Drag blocks from the palette to the timeline'}</li>
          <li>{isRTL ? 'הגדירו את כל בלוק בפאנל ההגדרות' : 'Configure each block in the settings panel'}</li>
          <li>{isRTL ? 'שמרו ותזמנו' : 'Save and schedule'}</li>
        </ol>
      </div>

      {/* Block Types */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'סוגי בלוקים' : 'Block Types'}
        </h3>
        <p className="text-dark-300 mb-4">
          {isRTL
            ? 'כל בלוק מייצג פעולה אחת בזרימה:'
            : 'Each block represents one action in the flow:'}
        </p>

        <div className="grid gap-3">
          {blockTypes.map((block) => {
            const Icon = block.icon
            return (
              <div key={block.name} className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
                <div className="p-2 rounded-lg bg-primary-500/20">
                  <Icon size={18} className="text-primary-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-dark-100">
                    {isRTL ? block.nameHe : block.name}
                  </h4>
                  <p className="text-sm text-dark-400">
                    {isRTL ? block.descHe : block.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <HelpScreenshot
          src="/help/New-Flow.jpg"
          alt="Blocks palette"
          caption="Drag blocks from the palette"
          captionHe="גררו בלוקים מהפלטה"
        />
      </div>

      {/* Timeline Editor */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'עורך ציר הזמן' : 'Timeline Editor'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'ציר הזמן מציג את הפעולות בסדר. תוכלו:'
            : 'The timeline shows actions in order. You can:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'גרור בלוקים לשינוי סדר' : 'Drag blocks to reorder'}</li>
          <li>{isRTL ? 'לחץ על בלוק להגדרות' : 'Click a block to configure'}</li>
          <li>{isRTL ? 'לחץ כפול להסרה' : 'Double-click to remove'}</li>
          <li>{isRTL ? 'השתמש ב-Preview לתצוגה מקדימה' : 'Use Preview to see how it plays'}</li>
        </ul>

        <HelpScreenshot
          src="/help/Actions-Studio.jpg"
          alt="Timeline editor"
          caption="The timeline shows your flow sequence"
          captionHe="ציר הזמן מציג את רצף הזרימה שלכם"
        />
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'תצוגה מקדימה' : 'Preview'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'לפני שמירה, השתמשו ב-Preview כדי לראות כיצד הזרימה תתנגן. זה מציג את הפריטים שייבחרו בפועל.'
            : 'Before saving, use Preview to see how the flow will play. This shows the actual items that will be selected.'}
        </p>

        <HelpScreenshot
          src="/help/Actions-Studio.jpg"
          alt="Flow preview"
          caption="Preview shows what will actually play"
          captionHe="התצוגה המקדימה מציגה מה יתנגן בפועל"
        />
      </div>

      {/* Scheduling */}
      <div className="mt-6 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
        <h4 className="font-semibold text-primary-400 mb-2">
          {isRTL ? 'תזמון זרימות' : 'Scheduling Flows'}
        </h4>
        <p className="text-dark-300 text-sm">
          {isRTL
            ? 'לאחר יצירת זרימה, לכו ללוח השנה כדי לתזמן אותה. תוכלו להגדיר פעימה חד-פעמית או חוזרת.'
            : 'After creating a flow, go to the Calendar to schedule it. You can set one-time or recurring events.'}
        </p>
      </div>
    </div>
  )
}
