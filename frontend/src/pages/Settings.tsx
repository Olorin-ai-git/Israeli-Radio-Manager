import { useTranslation } from 'react-i18next'
import { Globe, Bell, Cloud, Mail, Smartphone, MessageSquare } from 'lucide-react'

export default function Settings() {
  const { t, i18n } = useTranslation()

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('settings.title')}</h1>

      <div className="space-y-6">
        {/* Language Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe size={24} className="text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900">{t('settings.language')}</h2>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                i18n.language === 'en'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl mb-2 block">🇺🇸</span>
              <span className="font-medium">{t('settings.english')}</span>
            </button>
            <button
              onClick={() => handleLanguageChange('he')}
              className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                i18n.language === 'he'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl mb-2 block">🇮🇱</span>
              <span className="font-medium">{t('settings.hebrew')}</span>
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={24} className="text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900">{t('settings.notifications')}</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">{t('settings.email')}</p>
                  <p className="text-sm text-gray-500">Receive alerts via email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">{t('settings.push')}</p>
                  <p className="text-sm text-gray-500">Browser push notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">{t('settings.sms')}</p>
                  <p className="text-sm text-gray-500">Critical alerts via SMS</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Google Drive Connection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cloud size={24} className="text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900">{t('settings.googleDrive')}</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Google Drive</p>
              <p className="text-sm text-gray-500">{t('settings.notConnected')}</p>
            </div>
            <button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
              {t('settings.connect')}
            </button>
          </div>
        </div>

        {/* Admin Contact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare size={24} className="text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900">Admin Contact</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <input
                type="email"
                placeholder="admin@example.com"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Phone (for SMS)</label>
              <input
                type="tel"
                placeholder="+1234567890"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
              {t('actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
