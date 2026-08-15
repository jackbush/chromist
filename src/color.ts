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

/** Bare six-digit hex, no leading hash — the form used in the share URL. */
export function toBareHex(hsl: Hsl): string {
  return hslToHex(hsl).slice(1)
}
