import { converter } from 'culori'
import type { Colour, Gamut, ModeId } from './types'
import { isWide } from './gamut'

/**
 * The editing modes, as one table.
 *
 * Every mode is the same geometry read differently: a hue slider, and a square
 * whose two axes are the remaining channels. A descriptor says what those axes
 * are called, what range they cover, and how to get to and from the canonical
 * OKLab value. Nothing else in the app needs to know a mode exists.
 *
 * Two properties separate them, and both are visible in the UI:
 *
 * `srgbOnly` — HSL, HSB and HWB are re-labellings of the sRGB cube and cannot
 * name a colour outside it. OKHSL is in the same position for a subtler reason:
 * its saturation is a fraction of the chroma available *in sRGB*, so the space
 * is defined against that gamut too. Only OKLCH and LCh can reach Display P3.
 *
 * `fullSquare` — whether every point in the box is a real colour. It is true for
 * the sRGB re-labellings, whose square is the gamut by construction, and false
 * for the perceptual polar modes, where the reachable region is a shape that
 * changes with hue: at hue 200 against sRGB, an OKLCH square is four fifths
 * unreachable. Those modes draw the remainder as dead zone rather than pretend.
 */

export type { ModeId }

/** Picker coordinates in each mode's own units: `s` is the slider (always hue),
 *  `x` and `y` are the square, with `y` increasing upwards. */
export type Coords = { x: number; y: number; s: number }

type Axis = { label: string; min: number; max: number; precision: number }

export type Mode = {
  id: ModeId
  label: string
  x: Axis
  y: Axis
  slider: Axis
  srgbOnly: boolean
  fullSquare: boolean
  toCoords: (c: Colour, hueHint: number) => Coords
  fromCoords: (co: Coords) => Colour
  /** The mode's CSS notation, split so the two places it is used can differ:
   *  the field shows `args` alone, because the function name is fixed by the
   *  space already named in the select beside it, and the clipboard gets
   *  `fn(args)` so what you paste is a colour. Null where there is no CSS
   *  notation and both show hex — emitting `hsb(…)` would be inviting a paste
   *  into a stylesheet that silently does nothing. */
  css: { fn: string; args: (c: Colour, co: Coords) => string } | null
}

const toOklab = converter('oklab')
const HUE: Axis = { label: 'H', min: 0, max: 360, precision: 0 }
const PCT = (label: string): Axis => ({ label, min: 0, max: 100, precision: 0 })

/**
 * A grey has no hue, and the spaces disagree about how to say so: culori leaves
 * it undefined in HSL, while CIELAB's D50 adaptation leaves a trace of one and
 * reports a confident 139°. Neither is usable, so the question is asked of the
 * canonical colour — where grey is exactly a = b = 0 — and the picker's own
 * remembered hue is used instead. Without this, dragging lightness through a
 * neutral snaps the slider somewhere arbitrary.
 */
const isGrey = (c: Colour) => Math.abs(c.a) < 1e-4 && Math.abs(c.b) < 1e-4

/**
 * Guards the one place a conversion can hand back nothing: OKHSL at lightness 0
 * or 100 divides by a chroma that is zero, and returns NaN for every channel at
 * any saturation above nothing. A NaN here would be written to storage and into
 * the share link, so it is resolved to the colour those coordinates mean —
 * lightness 0 is black whatever the saturation says, and 100 is white.
 */
const oklab = (c: { l?: number; a?: number; b?: number }, fallbackL = 0): Colour => {
  const l = c.l ?? 0
  if (!Number.isFinite(l) || !Number.isFinite(c.a ?? 0) || !Number.isFinite(c.b ?? 0)) {
    return { l: fallbackL, a: 0, b: 0 }
  }
  return { l, a: c.a ?? 0, b: c.b ?? 0 }
}

/** A mode that rides on one of culori's polar sRGB spaces, where the square is
 *  two percentages and the slider is hue. The four of them differ only in which
 *  channels the axes are, so they are built from one shape. */
function polar(
  id: ModeId,
  label: string,
  mode: 'hsl' | 'hsv' | 'hwb' | 'okhsl',
  xKey: string,
  yKey: string,
  x: Axis,
  y: Axis,
  css: Mode['css'],
): Mode {
  // culori keeps these channels as fractions and hue in degrees; the UI wants
  // percentages, which is the only difference between its units and ours.
  const to = converter(mode) as unknown as (c: unknown) => Record<string, number | undefined>
  return {
    id,
    label,
    x,
    y,
    slider: HUE,
    srgbOnly: true,
    fullSquare: true,
    toCoords: (c, hueHint) => {
      const p = to({ mode: 'oklab', ...c })
      return {
        x: (p[xKey] ?? 0) * 100,
        y: (p[yKey] ?? 0) * 100,
        s: isGrey(c) ? hueHint : (p.h ?? hueHint),
      }
    },
    fromCoords: (co) =>
      oklab(
        toOklab({ mode, h: co.s, [xKey]: co.x / 100, [yKey]: co.y / 100 } as never) ?? {},
        // Only OKHSL can fail here, and only at the ends of its lightness axis.
        yKey === 'l' ? co.y / 100 : 0,
      ),
    css,
  }
}

const round = (n: number, p: number) => n.toFixed(p)

export const MODES: Mode[] = [
  polar(
    'hsl',
    'HSL',
    'hsl',
    's',
    'l',
    PCT('S'),
    PCT('L'),
    { fn: 'hsl', args: (_c, co) => `${round(co.s, 0)} ${round(co.x, 0)}% ${round(co.y, 0)}%` },
  ),
  polar(
    'hsb',
    'HSB',
    'hsv',
    's',
    'v',
    PCT('S'),
    PCT('B'),
    null, // HSB has no CSS function — the field shows hex
  ),
  polar(
    'hwb',
    'HWB',
    'hwb',
    'w',
    'b',
    PCT('W'),
    PCT('B'),
    { fn: 'hwb', args: (_c, co) => `${round(co.s, 0)} ${round(co.x, 0)}% ${round(co.y, 0)}%` },
  ),
  polar(
    'okhsl',
    'OKHSL',
    'okhsl',
    's',
    'l',
    PCT('S'),
    PCT('L'),
    null, // no CSS function — the field shows hex
  ),
  {
    id: 'oklch',
    label: 'OKLCH (P3)',
    x: { label: 'C', min: 0, max: 0.4, precision: 3 },
    y: { label: 'L', min: 0, max: 1, precision: 3 },
    slider: HUE,
    srgbOnly: false,
    fullSquare: false,
    toCoords: (c, hueHint) => {
      const p = converter('oklch')({ mode: 'oklab', ...c })
      return { x: p.c ?? 0, y: p.l ?? 0, s: isGrey(c) ? hueHint : (p.h ?? hueHint) }
    },
    fromCoords: (co) => oklab(toOklab({ mode: 'oklch', l: co.y, c: co.x, h: co.s }) ?? {}),
    css: { fn: 'oklch', args: (_c, co) => `${round(co.y, 3)} ${round(co.x, 3)} ${round(co.s, 1)}` },
  },
  {
    id: 'lch',
    label: 'LCh (P3)',
    x: { label: 'C', min: 0, max: 150, precision: 1 },
    y: { label: 'L', min: 0, max: 100, precision: 1 },
    slider: HUE,
    srgbOnly: false,
    fullSquare: false,
    toCoords: (c, hueHint) => {
      const p = converter('lch')({ mode: 'oklab', ...c })
      return { x: p.c ?? 0, y: p.l ?? 0, s: isGrey(c) ? hueHint : (p.h ?? hueHint) }
    },
    fromCoords: (co) => oklab(toOklab({ mode: 'lch', l: co.y, c: co.x, h: co.s }) ?? {}),
    css: { fn: 'lch', args: (_c, co) => `${round(co.y, 1)}% ${round(co.x, 1)} ${round(co.s, 1)}` },
  },
]

/** Perceptual, and the only such space whose square has no unreachable
 *  corner — so it behaves like HSL while telling the truth. */
export const DEFAULT_MODE: ModeId = 'okhsl'

export function modeById(id: ModeId): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0]
}

/**
 * The gamut a mode works in. It isn't a separate choice — HSL cannot name a
 * colour outside sRGB whatever you ask of it, and OKLCH would be pointlessly
 * fenced in if held to sRGB — so picking the space picks the reach, and the two
 * P3 modes say so in their own names.
 */
export function gamutFor(mode: Mode): Gamut {
  return mode.srgbOnly ? 'srgb' : 'p3'
}

/**
 * Whether moving a colour into this space would have to change it.
 *
 * Only ever true one way round: every sRGB colour has an OKLCH reading, but a
 * colour past sRGB has no HSL one at all, so the move is lossy and worth asking
 * about rather than performing quietly.
 */
export function wouldClamp(mode: Mode, colour: Colour): boolean {
  return gamutFor(mode) === 'srgb' && isWide(colour)
}

/** How many of a palette the space cannot describe. The space applies to all of
 *  them, so this is what the warning has to count. */
export function clampCount(mode: Mode, colours: Colour[]): number {
  return colours.filter((c) => wouldClamp(mode, c)).length
}
