import { InputHTMLAttributes } from 'react'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value' | 'min' | 'max' | 'step'> {
  label?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  showValue?: boolean
  unit?: string
  marks?: { value: number; label: string }[]
}

export default function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  showValue = true,
  unit = '',
  marks,
  className = '',
  ...props
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value))
  }

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-3">
          {label && (
            <label className="text-sm font-medium text-dark-200">{label}</label>
          )}
          {showValue && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-500/20 border border-primary-500/30">
              <span className="text-sm font-semibold text-primary-400">
                {value}
              </span>
              {unit && (
                <span className="text-xs text-primary-400/70">{unit}</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="relative">
        {/* Track background */}
        <div className="h-2 rounded-full bg-dark-700/50 backdrop-blur-sm border border-white/5 overflow-hidden">
          {/* Filled track */}
          <div
            className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-150 ease-out relative"
            style={{ width: `${percentage}%` }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/50 to-primary-300/50 blur-sm" />
          </div>
        </div>

        {/* Input overlay */}
        <input
          type="range"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          {...props}
        />

        {/* Custom thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-lg border-2 border-primary-500 pointer-events-none transition-all duration-150"
          style={{ left: `calc(${percentage}% - 10px)` }}
        >
          <div className="absolute inset-0 rounded-full bg-primary-500/30 blur animate-pulse" />
        </div>
      </div>

      {/* Marks */}
      {marks && marks.length > 0 && (
        <div className="relative mt-2 px-1">
          {marks.map((mark) => {
            const markPercentage = ((mark.value - min) / (max - min)) * 100
            return (
              <div
                key={mark.value}
                className="absolute -translate-x-1/2"
                style={{ left: `${markPercentage}%` }}
              >
                <div className={`text-xs whitespace-nowrap ${
                  value === mark.value ? 'text-primary-400 font-medium' : 'text-dark-400'
                }`}>
                  {mark.label}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
