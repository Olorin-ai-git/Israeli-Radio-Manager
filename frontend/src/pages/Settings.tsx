import { useTranslation } from 'react-i18next'
import { Globe, Bell, Cloud, Mail, Smartphone, MessageSquare } from 'lucide-react'

export default function Settings() {
  const { t, i18n } = useTranslation()

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-dark-100 mb-6">{t('settings.title')}</h1>

      <div className="space-y-6">
        {/* Language Settings */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center border border-primary-500/30">
              <Globe size={20} className="text-primary-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-100">{t('settings.language')}</h2>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                i18n.language === 'en'
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-white/10 hover:border-white/20 bg-dark-700/30'
              }`}
            >
              <span className="text-2xl mb-2 block">🇺🇸</span>
              <span className="font-medium text-dark-100">{t('settings.english')}</span>
            </button>
            <button
              onClick={() => handleLanguageChange('he')}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                i18n.language === 'he'
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-white/10 hover:border-white/20 bg-dark-700/30'
              }`}
            >
              <span className="text-2xl mb-2 block">🇮🇱</span>
              <span className="font-medium text-dark-100">{t('settings.hebrew')}</span>
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
              <Bell size={20} className="text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-100">{t('settings.notifications')}</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-dark-400" />
                <div>
                  <p className="font-medium text-dark-100">{t('settings.email')}</p>
                  <p className="text-sm text-dark-400">Receive alerts via email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-300 after:border-dark-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-dark-400" />
                <div>
                  <p className="font-medium text-dark-100">{t('settings.push')}</p>
                  <p className="text-sm text-dark-400">Browser push notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-300 after:border-dark-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-dark-400" />
                <div>
                  <p className="font-medium text-dark-100">{t('settings.sms')}</p>
                  <p className="text-sm text-dark-400">Critical alerts via SMS</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-300 after:border-dark-500 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Google Drive Connection */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center border border-sky-500/30">
              <Cloud size={20} className="text-sky-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-100">{t('settings.googleDrive')}</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-dark-100">Google Drive</p>
              <p className="text-sm text-dark-400">{t('settings.notConnected')}</p>
            </div>
            <button className="px-4 py-2 glass-button-primary">
              {t('settings.connect')}
            </button>
          </div>
        </div>

        {/* Admin Contact */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
              <MessageSquare size={20} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-100">Admin Contact</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Admin Email</label>
              <input
                type="email"
                placeholder="admin@example.com"
                className="w-full px-4 py-2.5 glass-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Admin Phone (for SMS)</label>
              <input
                type="tel"
                placeholder="+1234567890"
                className="w-full px-4 py-2.5 glass-input"
              />
            </div>
            <button className="px-4 py-2 glass-button-primary">
              {t('actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
