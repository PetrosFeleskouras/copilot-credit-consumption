import { createLightTheme } from '@fluentui/react-components'
import type { BrandVariants, Theme } from '@fluentui/react-components'

// Teal-green brand ramp approximating the Power Platform admin center accent
// (active tab underline, selected nav, links, primary actions).
const ppacTeal: BrandVariants = {
  10: '#001512',
  20: '#00201B',
  30: '#00352C',
  40: '#00463A',
  50: '#005748',
  60: '#006A57',
  70: '#0F7B67',
  80: '#1E8A76',
  90: '#2E9985',
  100: '#41A794',
  110: '#57B5A4',
  120: '#6FC3B4',
  130: '#89D0C4',
  140: '#A4DED4',
  150: '#C0EBE4',
  160: '#DDF6F1',
}

export const ppacLightTheme: Theme = {
  ...createLightTheme(ppacTeal),
}

// Chart colors aligned to the PPAC palette (teal primary, purple/magenta accents).
export const CHART_PRIMARY = '#1E8A76' // teal
export const CHART_ACCENT = '#8661C5' // purple (PPAC bar tone)
export const CHART_CONTRAST = '#C4314B' // magenta for the rolling-average line
