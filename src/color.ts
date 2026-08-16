import { converter, formatHex, parse } from 'culori'
import type { Hsl } from './types'

const toHsl = converter('hsl')

/**
 * culori leaves `h` undefined for achromatic colours (any pure grey, which
 * includes two of our three themes), so every read of it needs a fallback.
 *
 * Values are deliberately NOT rounded: integer HSL has ~3.7M states against
 * hex's 16.7M, so rounding here makes hex -> hsl -> hex drift (#2e86ab would
 * come back as #2e87ad). Round at the point of display instead.
 */
export function hexToHsl(hex: string): Hsl | null {
  const parsed = parse(hex)
  if (!parsed) return null
  const c = toHsl(parsed)
  if (!c) return null
  return { h: c.h ?? 0, s: (c.s ?? 0) * 100, l: (c.l ?? 0) * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  return formatHex({ mode: 'hsl', h, s: s / 100, l: l / 100 }) ?? '#000000'
}

export function hslToCss({ h, s, l }: Hsl): string {
  return `hsl(${h} ${s}% ${l}%)`
}

export function hslEquals(a: Hsl, b: Hsl): boolean {
  return a.h === b.h && a.s === b.s && a.l === b.l
}

/**
 * The opposite of a colour: hue rotated half a turn with lightness mirrored
 * around 50%, saturation untouched. Mirroring lightness is what keeps this
 * useful on neutrals — a plain hue rotation leaves any grey exactly where it
 * was, and the app's own theme colours are all greys.
 */
export function oppositeHsl({ h, s, l }: Hsl): Hsl {
  return { h: (h + 180) % 360, s, l: 100 - l }
}

/** Random hue, with saturation and lightness held in a usable band so the app
 *  never opens on something muddy or near-black. */
export function randomHsl(): Hsl {
  return {
    h: Math.random() * 360,
    s: 55 + Math.random() * 35,
    l: 40 + Math.random() * 25,
  }
}

/**
 * Keeps a new colour from duplicating one already in the palette — pressing `+`
 * twice would otherwise land back on the first colour, since the opposite of an
 * opposite is the original. Falls back to a fresh random colour, the same rule
 * the app starts on. Comparison is by hex, which is what the user actually sees.
 */
export function distinctFrom(candidate: Hsl, existing: Hsl[]): Hsl {
  const taken = new Set(existing.map(hslToHex))
  if (!taken.has(hslToHex(candidate))) return candidate

  // With at most 7 pins a free colour is found almost immediately; the bound is
  // only here so this can never spin.
  for (let i = 0; i < 50; i++) {
    const fresh = randomHsl()
    if (!taken.has(hslToHex(fresh))) return fresh
  }
  return randomHsl()
}

/** Bare six-digit hex, no leading hash — the form used in the share URL. */
export function toBareHex(hsl: Hsl): string {
  return hslToHex(hsl).slice(1)
}
