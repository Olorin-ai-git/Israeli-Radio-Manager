import { useState, useEffect, ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Bell, Mail, Smartphone, MessageSquare, Send, Loader2, Check } from 'lucide-react'
import Checkbox from '../components/Form/Checkbox'
import Input from '../components/Form/Input'
import api from '../services/api'
import { useToastStore } from '../store/toastStore'
import { useAuth } from '../contexts/AuthContext'
import { useDemoMode } from '../hooks/useDemoMode'

interface Settings {
  notifications: {
    email_enabled: boolean
    push_enabled: boolean
    sms_enabled: boolean
  }
  admin_contact: {
    email: string | null
    phone: string | null
  }
  vapid_public_key: string | null
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { addToast } = useToastStore()
  const { refreshUser } = useAuth()
  const { isViewer, isDemoHost } = useDemoMode()
  const isInDemoMode = isViewer && isDemoHost
  const isRTL = i18n.language === 'he'

  // Loading states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [testingChannel, setTestingChannel] = useState<string | null>(null)

  // Settings state
  const [settings, setSettings] = useState<Settings | null>(null)

  // Language selection state (local until saved)
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language)

  // Push subscription state
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [subscribingPush, setSubscribingPush] = useState(false)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
    checkPushSupport()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await api.getSettings()
      setSettings(data)
    } catch (error) {
      addToast('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const checkPushSupport = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true)
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        setPushSubscribed(!!subscription)
      } catch {
        // Service worker not ready yet
      }
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    if (isInDemoMode) {
      addToast(isRTL ? 'מצב הדגמה - שינויים לא נשמרים' : 'Demo mode - changes are not saved', 'info')
      return
    }

    setSaving(true)
    try {
      await api.updateSettings({
        notifications: settings.notifications,
        admin_contact: settings.admin_contact
      })
      addToast(t('settings.saved') || 'Settings saved', 'success')
    } catch (error) {
      addToast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const subscribeToPush = async () => {
    if (isInDemoMode) {
      addToast(isRTL ? 'מצב הדגמה - שינויים לא נשמרים' : 'Demo mode - changes are not saved', 'info')
      return
    }

    if (!settings?.vapid_public_key) {
      addToast('Push notifications not configured on server', 'error')
      return
    }

    setSubscribingPush(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const vapidKey = urlBase64ToUint8Array(settings.vapid_public_key)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey as BufferSource
      })

      await api.subscribeToPush(subscription.toJSON())
      setPushSubscribed(true)
      addToast('Push notifications enabled', 'success')
    } catch (error) {
      addToast('Failed to enable push notifications', 'error')
    } finally {
      setSubscribingPush(false)
    }
  }

  const testNotification = async (channel: 'email' | 'push' | 'sms') => {
    if (isInDemoMode) {
      addToast(isRTL ? 'מצב הדגמה - שינויים לא נשמרים' : 'Demo mode - changes are not saved', 'info')
      return
    }

    setTestingChannel(channel)
    try {
      const result = await api.testNotification(channel)
      if (result.success) {
        addToast(`Test ${channel} notification sent`, 'success')
      } else {
        addToast(`Test ${channel} notification failed`, 'error')
      }
    } catch (error) {
      addToast(`Failed to send test notification`, 'error')
    } finally {
      setTestingChannel(null)
    }
  }

  const handleLanguageSelect = (lang: string) => {
    setSelectedLanguage(lang)
  }

  const saveLanguage = async () => {
    // Don't save if nothing changed
    if (selectedLanguage === i18n.language) return

    if (isInDemoMode) {
      // In demo mode, allow language change locally but don't save to server
      i18n.changeLanguage(selectedLanguage)
      addToast(isRTL ? 'מצב הדגמה - שפה שונתה זמנית' : 'Demo mode - language changed temporarily', 'info')
      return
    }

    setSavingLanguage(true)
    try {
      // Update i18n locally
      i18n.changeLanguage(selectedLanguage)
      // Save to user profile
      await api.updateUserPreferences({ language: selectedLanguage })
      await refreshUser()
      addToast(t('settings.saved') || 'Language saved', 'success')
    } catch (error) {
      addToast('Failed to save language preference', 'error')
    } finally {
      setSavingLanguage(false)
    }
  }

  const updateNotificationSetting = (key: keyof Settings['notifications'], value: boolean) => {
    if (!settings) return
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value
      }
    })
  }

  const updateAdminContact = (key: keyof Settings['admin_contact'], value: string) => {
    if (!settings) return
    setSettings({
      ...settings,
      admin_contact: {
        ...settings.admin_contact,
        [key]: value || null
      }
    })
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="p-6">
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

          <div className="flex gap-4 mb-4">
            <button
              onClick={() => handleLanguageSelect('en')}
              disabled={savingLanguage}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                selectedLanguage === 'en'
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-white/10 hover:border-white/20 bg-dark-700/30'
              } ${savingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-2xl mb-2 block">US</span>
              <span className="font-medium text-dark-100">{t('settings.english')}</span>
            </button>
            <button
              onClick={() => handleLanguageSelect('he')}
              disabled={savingLanguage}
              className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                selectedLanguage === 'he'
                  ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-white/10 hover:border-white/20 bg-dark-700/30'
              } ${savingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-2xl mb-2 block">IL</span>
              <span className="font-medium text-dark-100">{t('settings.hebrew')}</span>
            </button>
          </div>
          <button
            onClick={saveLanguage}
            disabled={savingLanguage || selectedLanguage === i18n.language}
            className="px-4 py-2 glass-button-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingLanguage ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {t('actions.save')}
          </button>
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
            <div className="py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex-1">
                <Checkbox
                  label={t('settings.email')}
                  description="Receive alerts via email"
                  checked={settings?.notifications?.email_enabled ?? true}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateNotificationSetting('email_enabled', e.target.checked)
                  }
                />
              </div>
              <button
                onClick={() => testNotification('email')}
                disabled={testingChannel !== null}
                className="ml-4 px-3 py-1.5 text-sm glass-button flex items-center gap-2"
              >
                {testingChannel === 'email' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Test
              </button>
            </div>

            <div className="py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex-1">
                <Checkbox
                  label={t('settings.push')}
                  description="Browser push notifications"
                  checked={settings?.notifications?.push_enabled ?? true}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateNotificationSetting('push_enabled', e.target.checked)
                  }
                />
              </div>
              <div className="ml-4 flex gap-2">
                {pushSupported && !pushSubscribed && (
                  <button
                    onClick={subscribeToPush}
                    disabled={subscribingPush}
                    className="px-3 py-1.5 text-sm glass-button-primary flex items-center gap-2"
                  >
                    {subscribingPush ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Bell size={14} />
                    )}
                    Enable
                  </button>
                )}
                {pushSubscribed && (
                  <span className="px-3 py-1.5 text-sm text-green-400 flex items-center gap-2">
                    <Check size={14} />
                    Enabled
                  </span>
                )}
                <button
                  onClick={() => testNotification('push')}
                  disabled={testingChannel !== null || !pushSubscribed}
                  className="px-3 py-1.5 text-sm glass-button flex items-center gap-2"
                >
                  {testingChannel === 'push' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Test
                </button>
              </div>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div className="flex-1">
                <Checkbox
                  label={t('settings.sms')}
                  description="Critical alerts via SMS (requires Twilio)"
                  checked={settings?.notifications?.sms_enabled ?? false}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateNotificationSetting('sms_enabled', e.target.checked)
                  }
                />
              </div>
              <button
                onClick={() => testNotification('sms')}
                disabled={testingChannel !== null}
                className="ml-4 px-3 py-1.5 text-sm glass-button flex items-center gap-2"
              >
                {testingChannel === 'sms' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Test
              </button>
            </div>
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
              value={settings?.admin_contact?.email || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateAdminContact('email', e.target.value)
              }
              icon={Mail}
              disabled={isInDemoMode}
            />
            <Input
              type="tel"
              label="Admin Phone (for SMS)"
              placeholder="+1234567890"
              value={settings?.admin_contact?.phone || ''}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateAdminContact('phone', e.target.value)
              }
              icon={Smartphone}
              disabled={isInDemoMode}
            />
            <button
              onClick={saveSettings}
              disabled={saving || isInDemoMode}
              className={`px-4 py-2 glass-button-primary flex items-center gap-2 ${isInDemoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isInDemoMode ? (isRTL ? 'מצב הדגמה' : 'Demo mode') : undefined}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {t('actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function for VAPID key conversion
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
