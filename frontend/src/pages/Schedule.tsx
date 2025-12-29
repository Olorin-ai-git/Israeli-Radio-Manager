import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit, Trash2, Calendar } from 'lucide-react'
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
        return 'badge-info'
      case 'show':
        return 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
      case 'commercial':
        return 'badge-success'
      default:
        return 'bg-dark-600/50 text-dark-300 border border-dark-500/30'
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-dark-100">{t('schedule.title')}</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 glass-button-primary"
        >
          <Plus size={20} />
          {t('schedule.addSlot')}
        </button>
      </div>

      {/* Schedule Grid */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-dark-400">Loading...</div>
        ) : Array.isArray(slots) && slots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>{t('schedule.contentType')}</th>
                  <th>{t('schedule.startTime')}</th>
                  <th>{t('schedule.endTime')}</th>
                  <th>{t('schedule.genre')}</th>
                  <th>Days</th>
                  <th>{t('schedule.priority')}</th>
                  <th>{t('schedule.enabled')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot: any) => (
                  <tr key={slot._id}>
                    <td>
                      <span className={`badge ${getContentTypeColor(slot.content_type)}`}>
                        {t(`content.${slot.content_type}`)}
                      </span>
                    </td>
                    <td className="text-sm text-dark-100 font-mono">
                      {slot.start_time}
                    </td>
                    <td className="text-sm text-dark-100 font-mono">
                      {slot.end_time}
                    </td>
                    <td className="text-sm text-dark-200">
                      {slot.genre || '-'}
                    </td>
                    <td className="text-sm text-dark-400">
                      {slot.day_of_week === 'all'
                        ? 'All days'
                        : Array.isArray(slot.day_of_week)
                        ? slot.day_of_week.map((d: number) => days[d].slice(0, 3)).join(', ')
                        : days[slot.day_of_week]?.slice(0, 3)}
                    </td>
                    <td className="text-sm text-dark-200">
                      {slot.priority}
                    </td>
                    <td>
                      <span className={`w-3 h-3 rounded-full inline-block ${slot.enabled ? 'bg-emerald-500 shadow-glow' : 'bg-dark-500'}`} />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 text-dark-400 hover:text-dark-200 hover:bg-white/5 rounded-lg transition-colors">
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteSlot.mutate(slot._id)}
                          className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"
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
            <Calendar size={48} className="mx-auto mb-4 text-dark-600" />
            <p className="text-dark-400 mb-4">No schedule slots configured</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 glass-button-primary"
            >
              {t('schedule.addSlot')}
            </button>
          </div>
        )}
      </div>

      {/* Add Slot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-dark-100 mb-4">{t('schedule.addSlot')}</h2>
            <p className="text-dark-400 mb-4">Schedule slot form will go here</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 glass-button"
              >
                {t('actions.cancel')}
              </button>
              <button className="px-4 py-2 glass-button-primary">
                {t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
