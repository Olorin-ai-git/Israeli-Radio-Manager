import { useState, ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Bell, Cloud, Mail, Smartphone, MessageSquare } from 'lucide-react'
import Checkbox from '../components/Form/Checkbox'
import Input from '../components/Form/Input'

export default function Settings() {
  const { t, i18n } = useTranslation()

  // Notification settings state
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)

  // Admin contact state
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPhone, setAdminPhone] = useState('')

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
            <div className="py-3 border-b border-white/5">
              <Checkbox
                label={t('settings.email')}
                description="Receive alerts via email"
                checked={emailNotifications}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailNotifications(e.target.checked)}
              />
            </div>

            <div className="py-3 border-b border-white/5">
              <Checkbox
                label={t('settings.push')}
                description="Browser push notifications"
                checked={pushNotifications}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPushNotifications(e.target.checked)}
              />
            </div>

            <div className="py-3">
              <Checkbox
                label={t('settings.sms')}
                description="Critical alerts via SMS"
                checked={smsNotifications}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSmsNotifications(e.target.checked)}
              />
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
            <Input
              type="email"
              label="Admin Email"
              placeholder="admin@example.com"
              value={adminEmail}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAdminEmail(e.target.value)}
              icon={Mail}
            />
            <Input
              type="tel"
              label="Admin Phone (for SMS)"
              placeholder="+1234567890"
              value={adminPhone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAdminPhone(e.target.value)}
              icon={Smartphone}
            />
            <button className="px-4 py-2 glass-button-primary">
              {t('actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
