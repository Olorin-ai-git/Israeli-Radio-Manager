import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectDropdownProps {
  label?: string
  values: string[]
  onChange: (values: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  allLabel?: string
  disabled?: boolean
  className?: string
}

export default function MultiSelectDropdown({
  label,
  values,
  onChange,
  options,
  placeholder = 'Select options...',
  allLabel = 'All',
  disabled,
  className = ''
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isAllSelected = values.length === 0 || values.length === options.length

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

  const handleToggleOption = (optionValue: string) => {
    if (values.includes(optionValue)) {
      // Remove the option
      const newValues = values.filter(v => v !== optionValue)
      onChange(newValues)
    } else {
      // Add the option
      onChange([...values, optionValue])
    }
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      // If all selected, keep all selected (no change)
      onChange([])
    } else {
      // Select all
      onChange([])
    }
  }

  // Display text for the button
  const getDisplayText = () => {
    if (isAllSelected) return allLabel
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || placeholder
    }
    return `${values.length} selected`
  }

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
            px-3 py-2 text-sm rounded-xl backdrop-blur-sm
            bg-dark-800/50 border border-white/10
            text-dark-100
            hover:border-white/20
            focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/30 focus:outline-none
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isOpen ? 'border-primary-500/50 ring-2 ring-primary-500/30' : ''}
          `}
        >
          <span className="text-dark-100 truncate">{getDisplayText()}</span>
          <ChevronDown
            size={16}
            className={`text-dark-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 p-1 rounded-xl
                        bg-dark-800/95 backdrop-blur-xl border border-white/10
                        shadow-2xl max-h-64 overflow-auto animate-slide-up">
            {/* All option */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`
                w-full flex items-center gap-3
                px-3 py-2.5 rounded-lg text-left
                transition-all duration-150
                ${isAllSelected
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-dark-200 hover:bg-white/5 hover:text-dark-100'
                }
              `}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                ${isAllSelected
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-dark-500 bg-dark-800/50'
                }
              `}>
                {isAllSelected && <Check size={10} strokeWidth={3} className="text-white" />}
              </div>
              <span className="text-sm font-medium">{allLabel}</span>
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-white/5" />

            {/* Options */}
            {options.map((option) => {
              const isSelected = isAllSelected || values.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleToggleOption(option.value)}
                  className={`
                    w-full flex items-center gap-3
                    px-3 py-2.5 rounded-lg text-left
                    transition-all duration-150
                    ${isSelected
                      ? 'bg-primary-500/10 text-primary-400'
                      : 'text-dark-200 hover:bg-white/5 hover:text-dark-100'
                    }
                  `}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${isSelected
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-dark-500 bg-dark-800/50 group-hover:border-dark-400'
                    }
                    transition-all duration-200
                  `}>
                    {isSelected && <Check size={10} strokeWidth={3} className="text-white" />}
                  </div>
                  <span className="text-sm">{option.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
