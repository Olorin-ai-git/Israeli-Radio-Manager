# Israeli Radio Manager - Design System

A comprehensive guide to the visual design, components, and styling standards for the Israeli Radio Manager application.

## Table of Contents
- [Overview](#overview)
- [Color Palette](#color-palette)
- [Typography](#typography)
- [Spacing System](#spacing-system)
- [Components](#components)
- [Accessibility](#accessibility)
- [Usage Guidelines](#usage-guidelines)

---

## Overview

The Israeli Radio Manager uses a **dark-first glassmorphism design** with a red accent color derived from the brand logo. The design system emphasizes:

- **Visual Consistency**: Glass-effect components with consistent blur and transparency
- **Accessibility**: High contrast ratios, visible focus states, keyboard navigation
- **RTL Support**: Full Hebrew language support with appropriate fonts
- **Performance**: Tailwind CSS utility classes for efficient bundling

---

## Color Palette

### Primary (Brand Red)
The main brand color used for CTAs, active states, and accents:

| Shade | Hex | Usage |
|-------|-----|-------|
| primary-400 | `#f87171` | Hover states, lighter accents |
| **primary-500** | **`#ef4444`** | **Main brand color (default)** |
| primary-600 | `#dc2626` | Pressed states, darker accents |

### Dark Theme
Background and text colors for the dark interface:

| Color | Hex | Usage |
|-------|-----|-------|
| dark-900 | `#0f172a` | Primary background |
| dark-800 | `#1e293b` | Secondary background, cards |
| dark-700 | `#334155` | Tertiary background, hover states |
| dark-400 | `#94a3b8` | Secondary text, muted content |
| dark-200 | `#e2e8f0` | Tertiary text |
| dark-100 | `#f1f5f9` | Primary text, high emphasis |

### Status Colors
Semantic colors for success, error, warning, and info states:

| Status | Background | Border | Text | Usage |
|--------|-----------|--------|------|-------|
| Success | `bg-emerald-500/20` | `border-emerald-500/30` | `text-emerald-400` | Confirmations, success messages |
| Error | `bg-red-500/20` | `border-red-500/30` | `text-red-400` | Errors, destructive actions |
| Warning | `bg-amber-500/20` | `border-amber-500/30` | `text-amber-400` | Warnings, cautions |
| Info | `bg-blue-500/20` | `border-blue-500/30` | `text-blue-400` | Informational messages |

### Action Type Colors
Colors for different flow action types:

| Action Type | Background | Border | Icon/Text |
|------------|-----------|--------|-----------|
| Play Genre | `bg-sky-500/20` | `border-sky-500/30` | `text-sky-400` |
| Play Content | `bg-blue-500/20` | `border-blue-500/30` | `text-blue-400` |
| Play Commercials | `bg-orange-500/20` | `border-orange-500/30` | `text-orange-400` |
| Play Show | `bg-purple-500/20` | `border-purple-500/30` | `text-purple-400` |
| Wait | `bg-gray-500/20` | `border-gray-500/30` | `text-gray-400` |
| Set Volume | `bg-emerald-500/20` | `border-emerald-500/30` | `text-emerald-400` |
| Announcement | `bg-amber-500/20` | `border-amber-500/30` | `text-amber-400` |

---

## Typography

### Font Families
- **English**: `Inter` - Clean, modern sans-serif with excellent readability
- **Hebrew (RTL)**: `Heebo` - Designed for Hebrew text with proper RTL support

Both fonts are loaded from Google Fonts and applied globally with fallbacks:
```css
font-family: 'Inter', '-apple-system', 'system-ui', 'sans-serif';
font-family: 'Heebo', 'Arial', 'sans-serif'; /* RTL */
```

### Type Scale
Consistent sizing for all text elements:

| Size | rem | px | Line Height | Usage |
|------|-----|----|-----------| ------|
| xs | 0.75rem | 12px | 1rem | Small labels, captions |
| sm | 0.875rem | 14px | 1.25rem | Body text (secondary), form labels |
| base | 1rem | 16px | 1.5rem | Body text (primary) |
| lg | 1.125rem | 18px | 1.75rem | Headings (small) |
| xl | 1.25rem | 20px | 1.75rem | Headings (medium) |

### Font Weights
- **Normal (400)**: Body text, descriptions
- **Medium (500)**: Labels, emphasized text
- **Semibold (600)**: Headings, titles
- **Bold (700)**: Strong emphasis

---

## Spacing System

Standardized spacing for consistent layouts:

| Token | Value | Usage |
|-------|-------|-------|
| `fieldGap` | `space-y-4` (1rem) | Between form fields |
| `sectionGap` | `space-y-6` (1.5rem) | Between major sections |
| `componentGap` | `gap-3` (0.75rem) | Between inline components |
| `labelMargin` | `mb-2` (0.5rem) | Labels to inputs |
| `errorMargin` | `mt-1.5` (0.375rem) | Error messages below inputs |

---

## Components

### Glassmorphism

All glass components use:
- **Backdrop blur**: Creates depth and hierarchy
- **Semi-transparent backgrounds**: Opacity values from tokens
- **Subtle borders**: `border-white/10` for definition
- **Consistent rounded corners**: `rounded-xl` or `rounded-2xl`

#### Glass Component Classes

| Class | Description | Usage |
|-------|-------------|-------|
| `.glass-card` | Main content cards | Panels, modals, containers |
| `.glass-sidebar` | Side navigation panels | Left/right sidebars |
| `.glass-input` | Form inputs | Text inputs, textareas, selects |
| `.glass-button` | Secondary buttons | Cancel, Edit, secondary actions |
| `.glass-button-primary` | Primary action buttons | Save, Submit, primary CTAs |
| `.glass-button-success` | Success/confirmation buttons | Approve, Confirm actions |
| `.glass-button-danger` | Destructive buttons | Delete, Remove actions |
| `.glass-button-warning` | Warning buttons | Cautionary actions |

### Buttons

#### Variants
```html
<!-- Secondary button -->
<button class="glass-button px-4 py-2.5">Cancel</button>

<!-- Primary button -->
<button class="glass-button-primary px-4 py-2.5">Save</button>

<!-- Success button -->
<button class="glass-button-success px-3 py-1.5 text-sm">Approve</button>

<!-- Danger button -->
<button class="glass-button-danger px-4 py-2.5">Delete</button>
```

#### Sizing
Standardized padding for consistency:

| Size | Padding | Text Size | Usage |
|------|---------|-----------|-------|
| Small | `px-3 py-1.5` | `text-xs` | Compact actions, inline buttons |
| **Medium** | **`px-4 py-2.5`** | **`text-sm`** | **Default button size** |
| Large | `px-5 py-3` | `text-base` | Prominent CTAs, hero buttons |

### Form Components

Located in `/src/components/Form/`:

#### Input
Text inputs with icon support, error states, and sizing:
```tsx
<Input
  label="Email"
  type="email"
  placeholder="user@example.com"
  error="Invalid email"
  icon={Mail}
  size="md"
/>
```

#### Textarea
Multi-line text inputs with character counting:
```tsx
<Textarea
  label="Description"
  rows={4}
  maxLength={500}
  showCount
  hint="Provide a detailed description"
/>
```

#### Select
Custom dropdown with glassmorphic styling:
```tsx
<Select
  label="Genre"
  value={genre}
  onChange={setGenre}
  options={[
    { value: 'pop', label: 'Pop' },
    { value: 'rock', label: 'Rock' },
  ]}
/>
```

#### Checkbox
Custom checkbox with checkmark animation:
```tsx
<Checkbox
  label="Enable notifications"
  description="Receive updates about your radio station"
  checked={enabled}
  onChange={(e) => setEnabled(e.target.checked)}
/>
```

#### Radio
Custom radio buttons with inner dot animation:
```tsx
<RadioGroup label="Playback mode">
  <Radio label="By duration" name="mode" value="duration" />
  <Radio label="By song count" name="mode" value="count" />
</RadioGroup>
```

#### Slider
Custom range slider with gradient fill:
```tsx
<Slider
  label="Volume"
  value={volume}
  onChange={setVolume}
  min={0}
  max={100}
  unit="%"
/>
```

#### ButtonGroup
Multi-select button group:
```tsx
<ButtonGroup
  label="Genre"
  value={selectedGenre}
  onChange={setSelectedGenre}
  options={[
    { value: 'pop', label: 'Pop' },
    { value: 'rock', label: 'Rock' },
  ]}
/>
```

### Animations

Standardized timing for consistency:

| Speed | Duration | Usage |
|-------|----------|-------|
| Fast | 150ms | Button presses, quick feedback |
| **Normal** | **200ms** | **Standard transitions (default)** |
| Slow | 300ms | Smooth animations, slides, panels |
| Pulse | 2s | Glow effects, pulse animations |

#### Animation Classes
- `.animate-slide-in-fade` - Queue item entrance (300ms)
- `.animate-slide-out-fade` - Queue item exit (300ms)
- `.animate-slide-up` - Panel slide up (200ms)
- `.animate-slide-in` - Toast fade in (200ms)
- `.animate-block-drop` - Block drop with bounce (300ms)

### Badges

Small labels for status and categories:
```html
<span class="badge badge-primary">Playing</span>
<span class="badge badge-success">Active</span>
<span class="badge badge-warning">Pending</span>
<span class="badge badge-info">Info</span>
```

### Tooltips

Contextual help text on hover:
```html
<div class="tooltip-trigger">
  <button>Hover me</button>
  <div class="tooltip tooltip-top">Helpful text</div>
</div>
```

---

## Accessibility

### Focus States

All interactive elements have visible focus rings:
- **Focus ring opacity**: `30%` (increased from 20% for visibility)
- **Focus ring width**: `2px`
- **Focus ring offset**: `2px` (for custom form elements)
- **Color**: `primary-500` (red accent)

```css
focus:ring-2 focus:ring-primary-500/30 focus:outline-none
```

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Tab order follows logical flow
- Enter/Space activate buttons and custom inputs
- Arrow keys navigate dropdowns and radio groups
- Escape closes modals and dropdowns

### Color Contrast

Minimum WCAG AA contrast ratios:
- **Normal text (14px+)**: 4.5:1
- **Large text (18px+)**: 3:1
- **UI components**: 3:1

Text color combinations:
- `text-dark-100` on `bg-dark-900`: ✅ 15.2:1
- `text-dark-400` on `bg-dark-800`: ✅ 5.8:1
- `text-primary-400` on `bg-primary-500/20`: ✅ 4.9:1

### Screen Reader Support

- Semantic HTML elements (`<button>`, `<label>`, `<input>`)
- ARIA labels where necessary
- Role attributes for custom components
- Alt text for images
- Descriptive link text

---

## Usage Guidelines

### Design Tokens

Always use design tokens from `/src/theme/tokens.ts`:

```typescript
import { getActionTypeColors, getStatusColors, SPACING, ANIMATION } from '@/theme/tokens'

// Get action type colors
const colors = getActionTypeColors('play_genre')
// colors.bg, colors.border, colors.icon

// Get status colors
const statusColors = getStatusColors('success')
// statusColors.bg, statusColors.border, statusColors.text

// Use spacing tokens
className={SPACING.fieldGap} // space-y-4

// Use animation timing
className={ANIMATION.normal} // 200ms
```

### Border Radius

Consistent rounding for visual harmony:

| Usage | Class | Radius |
|-------|-------|--------|
| Small elements | `rounded-lg` | 0.5rem (8px) |
| **Standard components** | **`rounded-xl`** | **0.75rem (12px)** |
| Large containers | `rounded-2xl` | 1rem (16px) |
| Circular elements | `rounded-full` | 50% |

### Opacity Scale

Standardized transparency values:

| Usage | Opacity | Example |
|-------|---------|---------|
| Glass card background | `/60` | `bg-dark-800/60` |
| Glass sidebar background | `/80` | `bg-dark-900/80` |
| Glass input background | `/50` | `bg-dark-800/50` |
| Default borders | `/10` | `border-white/10` |
| Hover borders | `/20` | `hover:border-white/20` |
| Focus borders | `/50` | `focus:border-primary-500/50` |
| Focus rings | `/30` | `focus:ring-primary-500/30` |
| Badge backgrounds | `/20` | `bg-emerald-500/20` |

### RTL Support

The application fully supports Hebrew (RTL):

```tsx
// Automatic direction and font
<div dir={isRTL ? 'rtl' : 'ltr'}>
  {/* Content automatically uses Heebo font */}
</div>

// Text alignment
<p className={isRTL ? 'text-right' : 'text-left'}>...</p>

// Flex direction
<div className={isRTL ? 'flex-row-reverse' : 'flex-row'}>...</div>
```

---

## Examples

### Form Layout
```tsx
<form className="space-y-4"> {/* fieldGap */}
  <Input
    label="Name"
    placeholder="Enter your name"
    required
  />

  <Textarea
    label="Description"
    rows={4}
    hint="Optional description"
  />

  <Select
    label="Genre"
    value={genre}
    onChange={setGenre}
    options={genres}
  />

  <div className="flex gap-3 justify-end"> {/* componentGap */}
    <button className="glass-button px-4 py-2.5">
      Cancel
    </button>
    <button className="glass-button-primary px-4 py-2.5">
      Save
    </button>
  </div>
</form>
```

### Card Layout
```tsx
<div className="glass-card p-6">
  <h2 className="text-lg font-semibold text-dark-100 mb-4">
    Card Title
  </h2>
  <p className="text-sm text-dark-400 mb-6">
    Card description or content goes here.
  </p>
  <button className="glass-button-primary px-4 py-2.5">
    Action
  </button>
</div>
```

---

## Resources

- **Tailwind Config**: `/tailwind.config.js`
- **Global CSS**: `/src/index.css`
- **Design Tokens**: `/src/theme/tokens.ts`
- **Form Components**: `/src/components/Form/`
- **Google Fonts**: [Inter](https://fonts.google.com/specimen/Inter), [Heebo](https://fonts.google.com/specimen/Heebo)

---

## Version History

- **v1.0** (Current) - Initial design system documentation with glassmorphism theme, standardized spacing, and centralized tokens
