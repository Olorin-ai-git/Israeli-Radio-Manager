import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Calendar, Clock } from 'lucide-react'
import { api } from '../services/api'

export default function Schedule() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)

  const { data: slots, isLoading } = useQuery({
    queryKey: ['schedule'],
    queryFn: api.getSchedule,
  })

  const deleteSlot = useMutation({
    mutationFn: (id: string) => api.deleteSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
    },
  })

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  const getContentTypeColor = (type: string) => {
    switch (type) {
      case 'song':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'show':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'commercial':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('schedule.title')}</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus size={20} />
          {t('schedule.addSlot')}
        </button>
      </div>

      {/* Schedule Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : slots && slots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('schedule.contentType')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('schedule.startTime')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('schedule.endTime')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('schedule.genre')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    Days
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('schedule.priority')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                    {t('schedule.enabled')}
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {slots.map((slot: any) => (
                  <tr key={slot._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getContentTypeColor(slot.content_type)}`}>
                        {t(`content.${slot.content_type}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {slot.start_time}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                      {slot.end_time}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {slot.genre || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {slot.day_of_week === 'all'
                        ? 'All days'
                        : Array.isArray(slot.day_of_week)
                        ? slot.day_of_week.map((d: number) => days[d].slice(0, 3)).join(', ')
                        : days[slot.day_of_week]?.slice(0, 3)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {slot.priority}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`w-3 h-3 rounded-full inline-block ${slot.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteSlot.mutate(slot._id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-4">No schedule slots configured</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              {t('schedule.addSlot')}
            </button>
          </div>
        )}
      </div>

      {/* Add Slot Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{t('schedule.addSlot')}</h2>
            <p className="text-gray-500 mb-4">Schedule slot form will go here</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('actions.cancel')}
              </button>
              <button className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                {t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
