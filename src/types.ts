/**
 * OKLab. `l` is perceptual lightness 0–1; `a` and `b` are the opponent axes,
 * unbounded but roughly -0.4…0.4 for anything a screen can show.
 *
 * Canonical because it is the only space here that holds a colour without
 * reference to a gamut — sRGB, Display P3 and everything between are the same
 * kind of value, and every editing mode is a pure function of it.
 */
export type Colour = { l: number; a: number; b: number }

export type Pin = { id: string; colour: Colour }

/** Two, and the app opens on the dark one. */
export type ThemeName = 'black' | 'white'

/**
 * What a screen can show.
 *
 * In the editor this is not a choice — the space implies it, see `gamutFor` in
 * modes.ts. In the audit it is: the same palette reads differently on a screen
 * that can only manage sRGB, because every wide colour is mapped into it first,
 * and that changes both what it looks like and what it measures.
 */
export type Gamut = 'srgb' | 'p3'

export const GAMUTS: Record<Gamut, { label: string }> = {
  srgb: { label: 'sRGB' },
  p3: { label: 'Display P3' },
}

/** The editing modes. What each one means is in `modes.ts`; the name lives here
 *  because a stored setting has to be checked against it. */
export type ModeId = 'hsl' | 'hsb' | 'hwb' | 'okhsl' | 'oklch' | 'lch'

/** Which contrast specification the audit reports. 2.2 is the one anyone is
 *  held to; 3.0 is a draft, and labelled as one. */
export type Spec = 'wcag22' | 'wcag30'

/** The nine weights the APCA font table has columns for. Both specs need it:
 *  APCA to pick a column, WCAG 2 to know where "large text" starts. */
export type Weight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

export const WEIGHTS: Weight[] = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export const SPECS: Record<Spec, { label: string }> = {
  wcag22: { label: '2.2' },
  wcag30: { label: '3.0 (Draft)' },
}

export type Settings = {
  theme: ThemeName
  mode: ModeId
  spec: Spec
  weight: Weight
  /** The audit's target. The editor takes its own from the space in use. */
  gamut: Gamut
}

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

