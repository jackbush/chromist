/** Hue 0–360, saturation and lightness 0–100 (react-colorful's convention). */
export type Hsl = { h: number; s: number; l: number }

export type Pin = { id: string; hsl: Hsl }

export type ThemeName = 'neutral' | 'black' | 'white'

export type Settings = { theme: ThemeName }

export const MAX_PINS = 7

export const THEMES: Record<ThemeName, { bg: string; fg: string; label: string }> = {
  neutral: { bg: '#4d4d4d', fg: '#000000', label: 'Neutral' },
  black: { bg: '#000000', fg: '#ffffff', label: 'Black' },
  white: { bg: '#ffffff', fg: '#000000', label: 'White' },
}
