/**
 * Design System Tokens
 *
 * Centralized design tokens for colors, spacing, opacity, animations, and sizing.
 * Use these tokens throughout the application for consistent styling.
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const COLORS = {
  primary: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',  // Main brand red
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  dark: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  // Status colors with bg/border/text variants for consistency
  status: {
    success: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      hover: 'hover:bg-emerald-500/30',
    },
    error: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/30',
      text: 'text-red-400',
      hover: 'hover:bg-red-500/30',
    },
    warning: {
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      hover: 'hover:bg-amber-500/30',
    },
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      hover: 'hover:bg-blue-500/30',
    },
  },

  // Action type colors (used in flows and action blocks)
  actionTypes: {
    play_genre: {
      bg: 'bg-sky-500/20',
      border: 'border-sky-500/30',
      text: 'text-sky-400',
      icon: 'text-sky-400',
    },
    play_content: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: 'text-blue-400',
    },
    play_commercials: {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
      icon: 'text-orange-400',
    },
    play_show: {
      bg: 'bg-purple-500/20',
      border: 'border-purple-500/30',
      text: 'text-purple-400',
      icon: 'text-purple-400',
    },
    wait: {
      bg: 'bg-gray-500/20',
      border: 'border-gray-500/30',
      text: 'text-gray-400',
      icon: 'text-gray-400',
    },
    set_volume: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      icon: 'text-emerald-400',
    },
    announcement: {
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: 'text-amber-400',
    },
  },
} as const

// ============================================================================
// SPACING SCALE
// ============================================================================

export const SPACING = {
  // Form field spacing
  fieldGap: 'space-y-4',          // Between form fields
  labelMargin: 'mb-2',            // Labels to inputs
  errorMargin: 'mt-1.5',          // Error messages below inputs
  hintMargin: 'mt-1.5',           // Hint text below inputs

  // Section spacing
  sectionGap: 'space-y-6',        // Between major sections

  // Component spacing
  componentGap: 'gap-3',          // Between inline components (buttons, icons)
  componentGapSm: 'gap-2',        // Tight component spacing
  componentGapLg: 'gap-4',        // Loose component spacing
} as const

// ============================================================================
// OPACITY SCALE
// ============================================================================

export const OPACITY = {
  glass: {
    card: '60',              // bg-dark-800/60 - Glass cards
    sidebar: '80',           // bg-dark-900/80 - Sidebars
    input: '50',             // bg-dark-800/50 - Form inputs
    button: '50',            // bg-dark-700/50 - Secondary buttons
    primary: '80',           // bg-primary-500/80 - Primary buttons
  },

  border: {
    default: '10',           // border-white/10 - Default borders
    hover: '20',             // hover:border-white/20 - Hover borders
    focus: '50',             // focus:border-primary-500/50 - Focus borders
    error: '50',             // border-red-500/50 - Error borders
  },

  overlay: {
    hover: '5',              // hover:bg-white/5 - Subtle hover overlays
    hoverStrong: '10',       // hover:bg-white/10 - Stronger hover overlays
    selected: '10',          // bg-primary-500/10 - Selected item background
    badge: '20',             // bg-[color]/20 - Badge backgrounds
  },

  focusRing: '30',           // focus:ring-primary-500/30 - Focus ring opacity (increased for accessibility)
} as const

// ============================================================================
// ANIMATION TIMING
// ============================================================================

export const ANIMATION = {
  fast: '150ms',             // Quick feedback (button presses)
  normal: '200ms',           // Standard transitions (default)
  slow: '300ms',             // Smooth animations (slides, panels)
  pulse: '2s',               // Pulse/glow effects
} as const

// Tailwind duration classes for convenience
export const DURATION_CLASSES = {
  fast: 'duration-150',
  normal: 'duration-200',
  slow: 'duration-300',
} as const

// ============================================================================
// COMPONENT SIZING
// ============================================================================

export const SIZES = {
  button: {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  },

  input: {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  },

  icon: {
    sm: 14,
    md: 18,
    lg: 24,
    xl: 32,
  },
} as const

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const RADIUS = {
  sm: 'rounded-lg',          // Small elements
  md: 'rounded-xl',          // Standard components (inputs, buttons, cards)
  lg: 'rounded-2xl',         // Large containers (modals, panels)
  full: 'rounded-full',      // Circular elements (avatars, badges)
} as const

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get action type color classes
 * @param actionType - The flow action type
 * @returns Object with bg, border, text, and icon classes
 */
export function getActionTypeColors(actionType: keyof typeof COLORS.actionTypes) {
  return COLORS.actionTypes[actionType]
}

/**
 * Get status color classes
 * @param status - The status type (success, error, warning, info)
 * @returns Object with bg, border, text, and hover classes
 */
export function getStatusColors(status: keyof typeof COLORS.status) {
  return COLORS.status[status]
}

/**
 * Combine multiple Tailwind classes
 * Useful for merging token classes with component-specific classes
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ActionType = keyof typeof COLORS.actionTypes
export type StatusType = keyof typeof COLORS.status
export type SizeVariant = keyof typeof SIZES.button
export type AnimationSpeed = keyof typeof ANIMATION
