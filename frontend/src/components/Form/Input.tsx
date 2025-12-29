import { forwardRef, InputHTMLAttributes } from 'react'
import { LucideIcon } from 'lucide-react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  icon?: LucideIcon
  iconRight?: LucideIcon
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    hint,
    icon: Icon,
    iconRight: IconRight,
    size = 'md',
    variant = 'default',
    className = '',
    ...props
  }, ref) => {
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-5 py-3 text-base'
    }

    const baseClasses = variant === 'ghost'
      ? 'bg-transparent border-0 focus:bg-dark-800/30'
      : 'bg-dark-800/50 border border-white/10 focus:border-primary-500/50'

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-dark-200 mb-2">
            {label}
            {props.required && <span className="text-primary-400 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">
              <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            </div>
          )}

          <input
            ref={ref}
            className={`
              w-full rounded-xl backdrop-blur-sm
              text-dark-100 placeholder-dark-400
              focus:ring-2 focus:ring-primary-500/20 focus:outline-none
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${baseClasses}
              ${sizeClasses[size]}
              ${Icon ? 'pl-10' : ''}
              ${IconRight ? 'pr-10' : ''}
              ${error ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20' : ''}
              ${className}
            `}
            {...props}
          />

          {IconRight && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400">
              <IconRight size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <span className="w-1 h-1 bg-red-400 rounded-full" />
            {error}
          </p>
        )}

        {hint && !error && (
          <p className="mt-1.5 text-xs text-dark-400">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
