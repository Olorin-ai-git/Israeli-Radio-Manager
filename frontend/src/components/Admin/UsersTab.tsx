import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Users,
  Shield,
  Edit,
  Eye,
  UserX,
  UserCheck,
  Search,
  ChevronDown,
  Clock,
  Mail
} from 'lucide-react'
import api from '../../services/api'

interface UsersTabProps {
  isRTL: boolean
}

interface User {
  _id: string
  firebase_uid: string
  email: string
  display_name: string
  photo_url: string | null
  role: 'admin' | 'editor' | 'viewer'
  is_active: boolean
  created_at: string
  last_login: string
}

const roleColors = {
  admin: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  editor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  viewer: 'text-dark-300 bg-dark-700/50 border-dark-600'
}

const roleLabels = {
  admin: { en: 'Admin', he: 'מנהל' },
  editor: { en: 'Editor', he: 'עורך' },
  viewer: { en: 'Viewer', he: 'צופה' }
}

const roleIcons = {
  admin: Shield,
  editor: Edit,
  viewer: Eye
}

export default function UsersTab({ isRTL }: UsersTabProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [showInactive, setShowInactive] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  // Fetch users
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', roleFilter, showInactive],
    queryFn: () => api.listUsers({
      role: roleFilter || undefined,
      include_inactive: showInactive,
      limit: 200
    }),
    retry: false
  })

  // Fetch user stats
  const { data: userStats } = useQuery({
    queryKey: ['admin', 'users', 'stats'],
    queryFn: api.getUserStats,
    retry: false
  })

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: 'admin' | 'editor' | 'viewer' }) =>
      api.setUserRole(uid, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    }
  })

  // Deactivate user mutation
  const deactivateMutation = useMutation({
    mutationFn: (uid: string) => api.deactivateUser(uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    }
  })

  // Reactivate user mutation
  const reactivateMutation = useMutation({
    mutationFn: (uid: string) => api.reactivateUser(uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    }
  })

  // Filter users by search query
  const users: User[] = usersData?.users || []
  const filteredUsers = users.filter(user =>
    user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRoleChange = (uid: string, newRole: 'admin' | 'editor' | 'viewer') => {
    changeRoleMutation.mutate({ uid, role: newRole })
    setOpenDropdown(null)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (error) {
    const axiosError = error as any
    const status = axiosError?.response?.status
    const detail = axiosError?.response?.data?.detail || axiosError?.message || 'Unknown error'
    const isAuthError = status === 401 || status === 403

    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-amber-400" size={48} />
          <h3 className="text-lg font-semibold text-dark-100 mb-2">
            {isAuthError
              ? (isRTL ? 'נדרשת הרשאת מנהל' : 'Admin Authorization Required')
              : (isRTL ? 'שגיאה בטעינת נתונים' : 'Error Loading Data')
            }
          </h3>
          <p className="text-sm text-dark-400">
            {isAuthError
              ? (isRTL ? 'עליך להתחבר עם חשבון מנהל כדי לצפות בדף זה' : 'Please sign in with an admin account to view this page')
              : detail
            }
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Statistics */}
      {userStats && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-primary-400" />
            <h3 className="font-semibold text-dark-100">
              {isRTL ? 'סטטיסטיקות משתמשים' : 'User Statistics'}
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Total */}
            <div className="p-4 rounded-lg bg-primary-500/10 border border-primary-500/30">
              <div className="text-2xl font-bold text-primary-400">{userStats.total}</div>
              <div className="text-sm text-dark-400">{isRTL ? 'סה"כ' : 'Total'}</div>
            </div>

            {/* Active */}
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-2xl font-bold text-emerald-400">{userStats.active}</div>
              <div className="text-sm text-dark-400">{isRTL ? 'פעילים' : 'Active'}</div>
            </div>

            {/* Admins */}
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="text-2xl font-bold text-amber-400">{userStats.by_role?.admin || 0}</div>
              <div className="text-sm text-dark-400">{isRTL ? 'מנהלים' : 'Admins'}</div>
            </div>

            {/* Editors */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="text-2xl font-bold text-blue-400">{userStats.by_role?.editor || 0}</div>
              <div className="text-sm text-dark-400">{isRTL ? 'עורכים' : 'Editors'}</div>
            </div>

            {/* Viewers */}
            <div className="p-4 rounded-lg bg-dark-700/50 border border-dark-600">
              <div className="text-2xl font-bold text-dark-300">{userStats.by_role?.viewer || 0}</div>
              <div className="text-sm text-dark-400">{isRTL ? 'צופים' : 'Viewers'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'חיפוש לפי שם או אימייל...' : 'Search by name or email...'}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:border-primary-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:border-primary-500"
          >
            <option value="">{isRTL ? 'כל התפקידים' : 'All Roles'}</option>
            <option value="admin">{isRTL ? 'מנהלים' : 'Admins'}</option>
            <option value="editor">{isRTL ? 'עורכים' : 'Editors'}</option>
            <option value="viewer">{isRTL ? 'צופים' : 'Viewers'}</option>
          </select>

          {/* Show Inactive Toggle */}
          <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
            />
            {isRTL ? 'הצג לא פעילים' : 'Show Inactive'}
          </label>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-600">
                <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">
                  {isRTL ? 'משתמש' : 'User'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">
                  {isRTL ? 'אימייל' : 'Email'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">
                  {isRTL ? 'תפקיד' : 'Role'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">
                  {isRTL ? 'התחברות אחרונה' : 'Last Login'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">
                  {isRTL ? 'סטטוס' : 'Status'}
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">
                  {isRTL ? 'פעולות' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-dark-400">
                    {searchQuery
                      ? (isRTL ? 'לא נמצאו משתמשים תואמים' : 'No matching users found')
                      : (isRTL ? 'לא נמצאו משתמשים' : 'No users found')
                    }
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const RoleIcon = roleIcons[user.role]
                  return (
                    <tr
                      key={user._id}
                      className={`border-b border-dark-700 hover:bg-white/5 ${
                        !user.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      {/* User */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.photo_url ? (
                            <img
                              src={user.photo_url}
                              alt={user.display_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                              <span className="text-primary-400 font-semibold">
                                {user.display_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-dark-100">{user.display_name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-dark-300">
                          <Mail size={14} />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === user._id ? null : user._id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${roleColors[user.role]} hover:opacity-80 transition-opacity`}
                          >
                            <RoleIcon size={14} />
                            <span className="text-sm font-medium">
                              {roleLabels[user.role][isRTL ? 'he' : 'en']}
                            </span>
                            <ChevronDown size={14} />
                          </button>

                          {/* Dropdown Menu */}
                          {openDropdown === user._id && (
                            <div className="absolute z-10 mt-1 w-36 bg-dark-800 border border-dark-600 rounded-lg shadow-lg overflow-hidden">
                              {(['admin', 'editor', 'viewer'] as const).map((role) => {
                                const Icon = roleIcons[role]
                                return (
                                  <button
                                    key={role}
                                    onClick={() => handleRoleChange(user.firebase_uid, role)}
                                    disabled={changeRoleMutation.isPending}
                                    className={`w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/10 transition-colors ${
                                      user.role === role ? 'bg-primary-500/10' : ''
                                    }`}
                                  >
                                    <Icon size={14} className={roleColors[role].split(' ')[0]} />
                                    <span className="text-sm text-dark-200">
                                      {roleLabels[role][isRTL ? 'he' : 'en']}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Last Login */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-dark-400">
                          <Clock size={14} />
                          <span className="text-sm">{formatDate(user.last_login)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            user.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {user.is_active
                            ? (isRTL ? 'פעיל' : 'Active')
                            : (isRTL ? 'לא פעיל' : 'Inactive')
                          }
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <button
                            onClick={() => deactivateMutation.mutate(user.firebase_uid)}
                            disabled={deactivateMutation.isPending}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title={isRTL ? 'השבת משתמש' : 'Deactivate User'}
                          >
                            <UserX size={16} />
                            <span>{isRTL ? 'השבת' : 'Deactivate'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateMutation.mutate(user.firebase_uid)}
                            disabled={reactivateMutation.isPending}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title={isRTL ? 'הפעל משתמש' : 'Reactivate User'}
                          >
                            <UserCheck size={16} />
                            <span>{isRTL ? 'הפעל' : 'Reactivate'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Results count */}
        <div className="px-6 py-3 border-t border-dark-700 text-sm text-dark-400">
          {isRTL
            ? `מציג ${filteredUsers.length} מתוך ${usersData?.total || 0} משתמשים`
            : `Showing ${filteredUsers.length} of ${usersData?.total || 0} users`
          }
        </div>
      </div>
    </div>
  )
}
