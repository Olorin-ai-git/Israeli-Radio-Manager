import { useToastStore, ToastType } from '../../store/toastStore'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { getStatusColors } from '../../theme/tokens'

const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type]
        const colors = getStatusColors(toast.type)
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-lg animate-slide-in ${colors.bg} ${colors.border}`}
            role="alert"
          >
            <Icon size={20} className={`flex-shrink-0 mt-0.5 ${colors.text}`} />
            <p className="flex-1 text-sm text-dark-100" dir="auto">
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={16} className="text-dark-300" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
