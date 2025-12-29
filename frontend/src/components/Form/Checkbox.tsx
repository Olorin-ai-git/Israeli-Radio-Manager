import { InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export default function Checkbox({ label, description, className = '', ...props }: CheckboxProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer group ${className}`}>
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          {...props}
        />
        {/* Custom checkbox */}
        <div className="w-5 h-5 rounded-lg border-2 border-dark-500 bg-dark-800/50 backdrop-blur-sm
                      peer-checked:border-primary-500 peer-checked:bg-primary-500
                      group-hover:border-dark-400
                      transition-all duration-200">
          {/* Checkmark */}
          <div className="absolute inset-0 flex items-center justify-center scale-0 peer-checked:scale-100
                        transition-transform duration-200 text-white">
            <Check size={14} strokeWidth={3} />
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="text-sm font-medium text-dark-100 group-hover:text-dark-50 transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-xs text-dark-400 mt-0.5">{description}</div>
        )}
      </div>
    </label>
  )
}
