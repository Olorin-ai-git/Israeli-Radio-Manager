import { useTranslation } from 'react-i18next'
import { Mic, Upload, Play, Star, Trash2, Volume2, AlertCircle } from 'lucide-react'

export default function VoiceStudioGuide() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <p className="text-dark-300 leading-relaxed">
        {isRTL
          ? 'סטודיו הקולות מאפשר לכם ליצור ולנהל קולות מותאמים אישית לטקסט-לדיבור (TTS). שכפלו קולות מקבצי אודיו ליצירת הכרזות אוטומטיות.'
          : 'Voice Studio allows you to create and manage custom Text-to-Speech (TTS) voices. Clone voices from audio files to create automated announcements.'}
      </p>

      {/* TTS Status */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Volume2 size={20} className="text-emerald-400" />
          {isRTL ? 'סטטוס שירות TTS' : 'TTS Service Status'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'בחלק העליון תראו את סטטוס שירות ה-TTS:'
            : 'At the top you\'ll see the TTS service status:'}
        </p>
        <ul className="list-disc list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'זמין/לא זמין - האם השירות מוכן לשימוש' : 'Available/Unavailable - whether the service is ready'}</li>
          <li>{isRTL ? 'מודל - סוג מנוע ה-TTS בשימוש' : 'Model - the TTS engine type being used'}</li>
          <li>{isRTL ? 'מכשיר - GPU או CPU לעיבוד' : 'Device - GPU or CPU for processing'}</li>
          <li>{isRTL ? 'מספר קולות - כמה קולות מוגדרים' : 'Voice count - how many voices are configured'}</li>
        </ul>
      </div>

      {/* Cloning a Voice */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100 flex items-center gap-2">
          <Mic size={20} className="text-primary-400" />
          {isRTL ? 'שכפול קול חדש' : 'Cloning a New Voice'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'ליצירת קול חדש, תזדקקו לקובץ אודיו של 3-10 שניות עם הקול הרצוי:'
            : 'To create a new voice, you\'ll need a 3-10 second audio file with the desired voice:'}
        </p>
        <ol className="list-decimal list-inside text-dark-300 space-y-2 mr-4">
          <li>{isRTL ? 'לחצו על "שכפל קול חדש"' : 'Click "Clone New Voice"'}</li>
          <li>{isRTL ? 'הזינו מזהה קול (באנגלית, לדוגמה: morning_dj)' : 'Enter a Voice ID (in English, e.g., morning_dj)'}</li>
          <li>{isRTL ? 'הזינו שם תצוגה (יכול להיות בעברית)' : 'Enter a display name (can be in Hebrew)'}</li>
          <li>{isRTL ? 'בחרו שפה (עברית או אנגלית)' : 'Select language (Hebrew or English)'}</li>
          <li>{isRTL ? 'העלו קובץ אודיו (WAV, MP3, OGG)' : 'Upload an audio file (WAV, MP3, OGG)'}</li>
          <li>{isRTL ? 'לחצו "שכפל קול"' : 'Click "Clone Voice"'}</li>
        </ol>

        <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Upload size={18} className="text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100 mb-1">
                {isRTL ? 'דרישות קובץ האודיו' : 'Audio File Requirements'}
              </h4>
              <ul className="text-sm text-dark-400 space-y-1">
                <li>{isRTL ? 'אורך: 3-10 שניות (אופטימלי: 5-7 שניות)' : 'Length: 3-10 seconds (optimal: 5-7 seconds)'}</li>
                <li>{isRTL ? 'איכות: ללא רעשי רקע' : 'Quality: No background noise'}</li>
                <li>{isRTL ? 'תוכן: דיבור ברור וטבעי' : 'Content: Clear, natural speech'}</li>
                <li>{isRTL ? 'פורמט: WAV, MP3, או OGG' : 'Format: WAV, MP3, or OGG'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Managing Voices */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'ניהול קולות' : 'Managing Voices'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'לכל קול ברשימה תוכלו לבצע את הפעולות הבאות:'
            : 'For each voice in the list, you can perform these actions:'}
        </p>

        <div className="grid gap-3">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Play size={18} className="text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'נגן תצוגה מקדימה' : 'Play Preview'}</h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'האזינו לקול עם הטקסט בשדה "טקסט לתצוגה מקדימה"' : 'Listen to the voice with the text in the "Preview Text" field'}
              </p>
            </div>
          </div>

          {/* Set Default */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Star size={18} className="text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'הגדר כברירת מחדל' : 'Set as Default'}</h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'הקול שישמש אוטומטית בהכרזות TTS' : 'The voice that will be used automatically for TTS announcements'}
              </p>
            </div>
          </div>

          {/* Delete */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-800/50 border border-white/5">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Trash2 size={18} className="text-red-400" />
            </div>
            <div>
              <h4 className="font-medium text-dark-100">{isRTL ? 'מחק קול' : 'Delete Voice'}</h4>
              <p className="text-xs text-dark-400">
                {isRTL ? 'הסרת קול מהמערכת (לא ניתן לשחזר)' : 'Remove a voice from the system (cannot be undone)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Using Voices in Flows */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-100">
          {isRTL ? 'שימוש בקולות בזרימות' : 'Using Voices in Flows'}
        </h3>
        <p className="text-dark-300">
          {isRTL
            ? 'לאחר יצירת קולות, תוכלו להשתמש בהם בסטודיו הפעולות:'
            : 'After creating voices, you can use them in Actions Studio:'}
        </p>
        <ol className="list-decimal list-inside text-dark-300 space-y-1 mr-4">
          <li>{isRTL ? 'הוסיפו בלוק "play_tts" לזרימה' : 'Add a "play_tts" block to your flow'}</li>
          <li>{isRTL ? 'בחרו את הקול מהרשימה' : 'Select the voice from the dropdown'}</li>
          <li>{isRTL ? 'הזינו את הטקסט להכרזה' : 'Enter the announcement text'}</li>
          <li>{isRTL ? 'שמרו ותזמנו את הזרימה' : 'Save and schedule the flow'}</li>
        </ol>
      </div>

      {/* Admin Note */}
      <div className="mt-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-purple-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-purple-400 mb-1">
              {isRTL ? 'הערה למנהלים' : 'Admin Note'}
            </h4>
            <p className="text-dark-300 text-sm">
              {isRTL
                ? 'סטודיו הקולות זמין רק למנהלי מערכת. ודאו ששירות ה-TTS מוגדר כראוי בהגדרות השרת.'
                : 'Voice Studio is only available to system administrators. Ensure the TTS service is properly configured in server settings.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
