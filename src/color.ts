import { converter, differenceCiede2000, parse } from 'culori'
import type { Colour, Gamut } from './types'
import { isInGamut, toCss, toGamut, toHex } from './gamut'

export { toCss, toHex, toGamut, isInGamut, isWide, cssVars } from './gamut'

const toOklab = converter('oklab')
const toOklch = converter('oklch')

/**
 * Values are deliberately NOT rounded. OKLab holds a colour exactly: hex ->
 * OKLab -> hex is lossless for all 16.7M sRGB colours (asserted in the checks),
 * so nothing drifts as long as rounding is left to the point of display.
 *
 * Unlike HSL there is no hue singularity to guard — a grey is simply a = b = 0.
 * The picker still has to remember a hue across greys, but that is a property of
 * the control, not of the colour.
 */
export function parseColour(text: string): Colour | null {
  const parsed = parse(text.trim())
  if (!parsed) return null
  const c = toOklab(parsed)
  if (!c) return null
  return { l: c.l ?? 0, a: c.a ?? 0, b: c.b ?? 0 }
}

export function colourEquals(x: Colour, y: Colour): boolean {
  return x.l === y.l && x.a === y.a && x.b === y.b
}

/**
 * The opposite of a colour: both opponent axes negated, lightness mirrored.
 *
 * Negating a and b is what a hue rotation of half a turn *is* in OKLab, and it
 * costs nothing on neutrals, where a rotation would be a no-op — mirroring
 * lightness is what keeps the result useful there, since the app's own theme
 * colours are all greys.
 *
 * Kept exact and unclamped so it stays its own inverse; fitting the result to a
 * gamut is `distinctFrom`'s job, and clamping here would break the involution.
 */
export function oppositeColour({ l, a, b }: Colour): Colour {
  return { l: 1 - l, a: -a, b: -b }
}

/** Perceptual distance. CIEDE2000 rather than Euclidean OKLab: the latter is
 *  badly nonlinear at the dark end, scoring #000000 against #0a0a0a some thirty
 *  times higher than a mid-tone pair that looks equally close. */
const difference = differenceCiede2000()

export function deltaE(x: Colour, y: Colour): number {
  return difference({ mode: 'oklab', ...x }, { mode: 'oklab', ...y })
}

/** The long-standing just-noticeable-difference for CIEDE2000. Below this, two
 *  colours are the same colour as far as an eye is concerned. */
export const JND = 2.3

/**
 * Random hue, with lightness and chroma held in a usable band so the app never
 * opens on something muddy or near-black. The band is written in OKLCH, where
 * it means the same thing at every hue — the equivalent HSL band does not, and
 * would open on a washed-out yellow as readily as a solid blue.
 *
 * Mapped into sRGB on the way out: the chroma that is available at a given
 * lightness varies by hue, and this band asks for more than blue can give.
 */
export function randomColour(): Colour {
  const c = toOklab({
    mode: 'oklch',
    l: 0.55 + Math.random() * 0.2,
    c: 0.1 + Math.random() * 0.05,
    h: Math.random() * 360,
  })
  return toGamut({ l: c.l ?? 0, a: c.a ?? 0, b: c.b ?? 0 }, 'srgb')
}

/**
 * Keeps a new colour from duplicating one already in the palette — pressing `+`
 * twice would otherwise land back on the first colour, since the opposite of an
 * opposite is the original. Also where the candidate is fitted to the target
 * gamut, since that is the point at which it becomes a colour to be shown.
 *
 * Comparison is perceptual, not by hex: two colours a single bit apart are the
 * same colour to look at, and adding one to a palette is never what was meant.
 */
export function distinctFrom(candidate: Colour, existing: Colour[], gamut: Gamut): Colour {
  const clear = (c: Colour) => existing.every((e) => deltaE(c, e) >= JND)

  const fitted = toGamut(candidate, gamut)
  if (clear(fitted)) return fitted

  // With at most 7 pins a free colour is found almost immediately; the bound is
  // only here so this can never spin.
  for (let i = 0; i < 50; i++) {
    const fresh = randomColour()
    if (clear(fresh)) return fresh
  }
  return randomColour()
}

/** The pairs in a palette that are too close to tell apart, as index pairs into
 *  the list given. What the audit reports on its diagonal. */
export function tooClose(colours: Colour[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < colours.length; i++) {
    for (let j = i + 1; j < colours.length; j++) {
      if (deltaE(colours[i], colours[j]) < JND) pairs.push([i, j])
    }
  }
  return pairs
}

/** Bare six-digit hex, no leading hash — the form used in the share URL. */
export function toBareHex(c: Colour): string {
  return toHex(c).slice(1)
}

/** How a colour is written into a paste list: hex while it fits in sRGB, and
 *  the wide form only when it has to be. */
export function toListText(c: Colour): string {
  if (isInGamut(c, 'srgb')) return toHex(c).toUpperCase()
  // Through toCss, so a pasted list gets the same rounded, clamped form the
  // stylesheet does rather than a raw conversion's float tail.
  return toCss(c, 'p3')
}

/** OKLCH is the useful polar reading of the canonical value — used by the
 *  picker, the mode table and anything that needs a hue. */
export function toLch(c: Colour): { l: number; c: number; h: number } {
  const p = toOklch({ mode: 'oklab', ...c })
  return { l: p.l ?? 0, c: p.c ?? 0, h: p.h ?? 0 }
}
