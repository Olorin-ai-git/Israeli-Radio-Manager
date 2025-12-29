import { InputHTMLAttributes } from 'react'

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export function Radio({ label, description, className = '', ...props }: RadioProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer group ${className}`}>
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="radio"
          className="sr-only peer"
          {...props}
        />
        {/* Custom radio */}
        <div className="w-5 h-5 rounded-full border-2 border-dark-500 bg-dark-800/50 backdrop-blur-sm
                      peer-checked:border-primary-500 peer-checked:bg-primary-500/20
                      group-hover:border-dark-400
                      transition-all duration-200">
          {/* Inner dot */}
          <div className="absolute inset-0 flex items-center justify-center scale-0
                        peer-checked:scale-100 transition-transform duration-200">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-glow" />
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

interface RadioGroupProps {
  label?: string
  children: React.ReactNode
  className?: string
}

export function RadioGroup({ label, children, className = '' }: RadioGroupProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-dark-200 mb-3">{label}</label>
      )}
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}
