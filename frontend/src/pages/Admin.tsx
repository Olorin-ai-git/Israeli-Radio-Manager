import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, LogOut, User, Settings, Bot, HardDrive, FileText, Activity, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import SystemConfigTab from '../components/Admin/SystemConfigTab'
import AgentSettingsTab from '../components/Admin/AgentSettingsTab'
import StorageSyncTab from '../components/Admin/StorageSyncTab'
import ContentManagementTab from '../components/Admin/ContentManagementTab'
import ServerManagementTab from '../components/Admin/ServerManagementTab'
import UsersTab from '../components/Admin/UsersTab'

export default function Admin() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'he'
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('system')

  const tabs = [
    { id: 'system', label: isRTL ? 'הגדרות מערכת' : 'System Config', icon: Settings },
    { id: 'agent', label: isRTL ? 'הגדרות AI' : 'AI Agent', icon: Bot },
    { id: 'storage', label: isRTL ? 'אחסון וסנכרון' : 'Storage & Sync', icon: HardDrive },
    { id: 'content', label: isRTL ? 'ניהול תוכן' : 'Content Management', icon: FileText },
    { id: 'server', label: isRTL ? 'ניהול שרת' : 'Server Management', icon: Activity },
    { id: 'users', label: isRTL ? 'משתמשים' : 'Users', icon: Users },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Admin Info Banner */}
      <div className="mb-6 p-4 bg-primary-500/20 border border-primary-500/30 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-primary-400" size={20} />
          <div>
            <h3 className="font-semibold text-primary-400 text-sm">
              {isRTL ? 'מנהל מערכת' : 'System Administrator'}
            </h3>
            <p className="text-xs text-dark-300 flex items-center gap-2">
              <User size={12} />
              {user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="glass-button flex items-center gap-2 px-4 py-2"
        >
          <LogOut size={16} />
          <span className="text-sm">{isRTL ? 'התנתק' : 'Sign Out'}</span>
        </button>
      </div>

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-primary-400" size={32} />
        <h1 className="text-2xl font-bold text-dark-100">
          {isRTL ? 'לוח ניהול' : 'Admin Dashboard'}
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card p-2 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-dark-300 hover:bg-white/5 hover:text-dark-100'
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="glass-card p-6">
        {activeTab === 'system' && <SystemConfigTab isRTL={isRTL} />}
        {activeTab === 'agent' && <AgentSettingsTab isRTL={isRTL} />}
        {activeTab === 'storage' && <StorageSyncTab isRTL={isRTL} />}
        {activeTab === 'content' && <ContentManagementTab isRTL={isRTL} />}
        {activeTab === 'server' && <ServerManagementTab isRTL={isRTL} />}
        {activeTab === 'users' && <UsersTab isRTL={isRTL} />}
      </div>
    </div>
  )
}
