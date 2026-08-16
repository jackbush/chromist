/** Hue 0–360, saturation and lightness 0–100 (react-colorful's convention). */
export type Hsl = { h: number; s: number; l: number }

export type Pin = { id: string; hsl: Hsl }

/** Two, and the app opens on the dark one. */
export type ThemeName = 'black' | 'white'

export type Settings = { theme: ThemeName }

export const MAX_PINS = 7

/** The colours themselves live in the stylesheet; this is the list of names
 *  that are real, which is what a stored setting is checked against. */
export const THEMES: Record<ThemeName, { bg: string; fg: string }> = {
  black: { bg: '#000000', fg: '#ffffff' },
  white: { bg: '#ffffff', fg: '#000000' },
}

export const OTHER_THEME: Record<ThemeName, ThemeName> = {
  black: 'white',
  white: 'black',
}
