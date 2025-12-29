interface ButtonGroupOption<T = string> {
  value: T
  label: string
  icon?: React.ReactNode
}

interface ButtonGroupProps<T = string> {
  label?: string
  value: T
  onChange: (value: T) => void
  options: ButtonGroupOption<T>[]
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  className?: string
}

export default function ButtonGroup<T = string>({
  label,
  value,
  onChange,
  options,
  size = 'md',
  fullWidth = false,
  className = ''
}: ButtonGroupProps<T>) {
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs min-w-[2rem]',
    md: 'px-3 py-2 text-sm min-w-[2.5rem]',
    lg: 'px-4 py-2.5 text-base min-w-[3rem]'
  }

  return (
    <div className={`${className}`}>
      {label && (
        <label className="block text-sm font-medium text-dark-200 mb-2">{label}</label>
      )}

      <div className={`flex ${fullWidth ? 'w-full' : ''} flex-wrap gap-2`}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              flex items-center justify-center gap-1.5
              rounded-xl backdrop-blur-sm border
              font-medium transition-all duration-200
              hover:scale-105 active:scale-95
              ${sizeClasses[size]}
              ${fullWidth ? 'flex-1' : ''}
              ${value === option.value
                ? 'bg-primary-500 border-primary-400/30 text-white shadow-glow'
                : 'bg-dark-700/50 border-white/10 text-dark-200 hover:bg-dark-600/50 hover:border-white/20'
              }
            `}
          >
            {option.icon && <span>{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
