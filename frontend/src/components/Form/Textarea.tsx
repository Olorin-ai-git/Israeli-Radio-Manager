import { forwardRef, TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  showCount?: boolean
  maxCount?: number
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    label,
    error,
    hint,
    showCount,
    maxCount,
    className = '',
    value = '',
    ...props
  }, ref) => {
    const currentLength = String(value).length

    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-dark-200">
              {label}
              {props.required && <span className="text-primary-400 ml-1">*</span>}
            </label>
            {showCount && (
              <span className={`text-xs ${
                maxCount && currentLength > maxCount
                  ? 'text-red-400'
                  : 'text-dark-400'
              }`}>
                {currentLength}{maxCount ? `/${maxCount}` : ''}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          value={value}
          className={`
            w-full rounded-xl backdrop-blur-sm
            bg-dark-800/50 border border-white/10
            px-4 py-3 text-sm
            text-dark-100 placeholder-dark-400
            focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/30 focus:outline-none
            transition-all duration-200
            resize-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/30' : ''}
            ${className}
          `}
          {...props}
        />

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

Textarea.displayName = 'Textarea'

export default Textarea
