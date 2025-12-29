import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  description?: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  error?: string
  disabled?: boolean
  className?: string
}

export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  error,
  disabled,
  className = ''
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className={`w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-dark-200 mb-2">{label}</label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full flex items-center justify-between
            px-4 py-2.5 text-sm rounded-xl backdrop-blur-sm
            bg-dark-800/50 border border-white/10
            text-dark-100
            hover:border-white/20
            focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/30 focus:outline-none
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500/50 focus:border-red-500/70' : ''}
            ${isOpen ? 'border-primary-500/50 ring-2 ring-primary-500/30' : ''}
          `}
        >
          <span className={selectedOption ? 'text-dark-100' : 'text-dark-400'}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`text-dark-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 p-1 rounded-xl
                        bg-dark-800/95 backdrop-blur-xl border border-white/10
                        shadow-2xl max-h-64 overflow-auto animate-slide-up">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between gap-2
                  px-3 py-2.5 rounded-lg text-left
                  transition-all duration-150
                  ${value === option.value
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-dark-200 hover:bg-white/5 hover:text-dark-100'
                  }
                `}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-dark-400 mt-0.5">{option.description}</div>
                  )}
                </div>
                {value === option.value && (
                  <Check size={16} className="text-primary-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
          <span className="w-1 h-1 bg-red-400 rounded-full" />
          {error}
        </p>
      )}
    </div>
  )
}
