import { wcagContrast } from 'culori'
import type { Colour, Weight } from './types'
import { toHex } from './gamut'

export { deltaE, tooClose, JND } from './color'

/**
 * WCAG 1.4.3 contrast, and the four bands the audit grid reports.
 *
 * The thresholds depend on the size of the text they're judging: 4.5 for AA at
 * body size, but only 3 once text is "large". AA+ is that middle ground: a pair
 * that passes AA at large sizes and fails it at body size.
 */
export type Score = 'AAA' | 'AA' | 'AA+' | 'FAIL'

/**
 * The size WCAG 2 calls "large": 18pt, or 14pt once the text is bold. In CSS
 * pixels at 96dpi that is 24 and 18.66, and the whole of WCAG 2's interest in
 * font weight is this one step at 700 — which is why the audit can offer a
 * weight control and still only move a single number on this side.
 */
export function largeTextPx(weight: Weight): number {
  return weight >= 700 ? 18.66 : 24
}

export function contrastRatio(a: Colour, b: Colour): number {
  return wcagContrast({ mode: 'oklab', ...a }, { mode: 'oklab', ...b })
}

export function scoreFor(ratio: number): Score {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA+'
  return 'FAIL'
}

/** Always rounded down, so a cell can never advertise a ratio it hasn't got:
 *  4.499 reads 4.49 beside its AA+, not a 4.50 that looks like a passing AA. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`
}

/* ---------------------------------------------------------------------------
 * APCA
 *
 * WCAG 2's ratio is a fixed formula that takes no account of which colour is
 * the text, and it misjudges the dark end badly — light text on a dark ground
 * scores far better than it reads. APCA (the WCAG 3 draft, algorithm
 * APCA-W3 0.1.9) is polarity-aware: it answers "this text, on this background",
 * and swapping them gives a different number. The audit grid is already
 * directional, so it fits without changing the shape of anything.
 *
 * It is reported *beside* the AAA/AA bands and never instead of them. APCA is
 * non-normative and nobody is held to it; WCAG 2 is what conformance means.
 * -------------------------------------------------------------------------*/

const TRC = 2.4
const CO = [0.2126729, 0.7151522, 0.072175]
const BLACK_THRESHOLD = 0.022
const BLACK_CLAMP = 1.414
const DELTA_Y_MIN = 0.0005
const LO_CLIP = 0.1
const SCALE = 1.14
const OFFSET = 0.027
const NORM_BG = 0.56
const NORM_TXT = 0.57
const REV_BG = 0.65
const REV_TXT = 0.62

/** Screen luminance, then a soft clamp that keeps near-blacks from running away
 *  to infinity as the exponent bites. APCA is defined on sRGB, so anything
 *  wider is mapped in first. */
function luminance(c: Colour): number {
  const hex = toHex(c)
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const y = ch.reduce((sum, v, i) => sum + v ** TRC * CO[i], 0)
  return y < BLACK_THRESHOLD ? y + (BLACK_THRESHOLD - y) ** BLACK_CLAMP : y
}

/**
 * Lightness contrast, roughly -108…+106. Positive means dark text on a light
 * ground, negative light on dark; what matters is the size. As a rough guide
 * APCA's own documentation puts 90 at body text, 75 at 24px, 60 at 36px, 45 at
 * large or bold, and under 30 at decoration only.
 */
export function apca(text: Colour, background: Colour): number {
  const txt = luminance(text)
  const bg = luminance(background)
  if (Math.abs(bg - txt) < DELTA_Y_MIN) return 0

  if (bg > txt) {
    const sapc = (bg ** NORM_BG - txt ** NORM_TXT) * SCALE
    return (sapc < LO_CLIP ? 0 : sapc - OFFSET) * 100
  }
  const sapc = (bg ** REV_BG - txt ** REV_TXT) * SCALE
  return (sapc > -LO_CLIP ? 0 : sapc + OFFSET) * 100
}

export function formatApca(lc: number): string {
  return `Lc ${Math.abs(lc) < 10 ? lc.toFixed(1) : Math.round(lc)}`
}

/* ---------------------------------------------------------------------------
 * The APCA font lookup
 *
 * What APCA is actually for. A ratio hands back one number and leaves you to
 * guess what it buys; APCA answers the question you had — how small can this
 * text be — and the answer depends on weight as much as on contrast, because a
 * hairline at 100 and a slab at 900 are not the same text.
 *
 * Rows run Lc 0 to 125 in fives, columns are weights 100–900, cells are the
 * minimum font size in px. Transcribed from `fontMatrixAscend` in apca-w3
 * 0.1.9's LUT-GseriesMay28-2022.js.
 * -------------------------------------------------------------------------*/

/** Too little contrast for text at any size. */
const PROHIBITED = 999
/** Enough to see, not enough to read: rules, borders, icons. */
const NON_TEXT = 777

/**
 * Transcribed verbatim, first column and all: the Lc label stays so the row a
 * lookup landed on can be asserted rather than trusted, and so the weight
 * columns are simply `weight / 100`.
 *
 * Note the rows are not evenly spaced — the table jumps 0, 10, 15, and carries
 * that offset for the rest of its length. The reference indexes it as
 * `floor(Lc / 5)` against an array whose first element is a header, so the
 * equivalent here is `floor(Lc / 5) - 1`. Getting that wrong reads every answer
 * one row too generous.
 */
// prettier-ignore
const FONT_LUT: number[][] = [
  // Lc     100      200     300     400      500      600      700     800   900
  [   0,    999,     999,    999,    999,     999,     999,     999,    999,  999],
  [  10,    999,     999,    999,    999,     999,     999,     999,    999,  999],
  [  15,    777,     777,    777,    777,     777,     777,     777,    777,  777],
  [  20,    777,     777,    777,    777,     777,     777,     777,    777,  777],
  [  25,    777,     777,    777,    120,     120,     108,      96,     96,   96],
  [  30,    777,     777,    120,    108,     108,      96,      72,     72,   72],
  [  35,    777,     120,    108,     96,      72,      60,      48,     48,   48],
  [  40,    120,     108,     96,     60,      48,      42,      32,     32,   32],
  [  45,    108,      96,     72,     42,      32,      28,      24,     24,   24],
  [  50,     96,      72,     60,     32,      28,      24,      21,     21,   21],
  [  55,     80,      60,     48,     28,      24,      21,      18,     18,   18],
  [  60,     72,      48,     42,     24,      21,      18,      16,     16,   18],
  [  65,     68,      46,     32,  21.75,      19,      17,      15,     16,   18],
  [  70,     64,      44,     28,   19.5,      18,      16,    14.5,     16,   18],
  [  75,     60,      42,     24,     18,      16,      15,      14,     16,   18],
  [  80,     56,   38.25,     23,  17.25,   15.81,   14.81,      14,     16,   18],
  [  85,     52,    34.5,     22,   16.5,  15.625,  14.625,      14,     16,   18],
  [  90,     48,      32,     21,     16,    15.5,    14.5,      14,     16,   18],
  [  95,     45,      28,   19.5,   15.5,      15,      14,    13.5,     16,   18],
  [ 100,     42,    26.5,   18.5,     15,    14.5,    13.5,      13,     16,   18],
  [ 105,     39,      25,     18,   14.5,      14,      13,      12,     16,   18],
  [ 110,     36,      24,     18,     14,      13,      12,      11,     16,   18],
  [ 115,   34.5,    22.5,  17.25,   12.5,  11.875,   11.25,  10.625,   14.5, 16.5],
  [ 120,     33,      21,   16.5,     11,   10.75,    10.5,   10.25,     13,   15],
  [ 125,     32,      20,     16,     10,      10,      10,      10,     12,   14],
]

/** Below this, APCA reports spot text — a copyright line, a placeholder — and
 *  declines to call anything fluently readable. */
const SPOT_ONLY_BELOW = 41

export type SizeLimit = 'spot' | 'non-text' | 'none'

/**
 * The smallest text this contrast will carry at this weight, or why it will
 * carry none.
 *
 * The Lc is floored to its row rather than interpolated within it. The
 * reference implementation ships a second table of deltas for that; leaving it
 * out errs the only safe way — Lc 74 is answered as Lc 70, asking for 19.5px at
 * weight 400 where interpolating would allow about 18.2 — and it is the same
 * rule `formatRatio` follows just above: never advertise what hasn't been
 * earned. Sign is dropped first; polarity decides the Lc, not what it buys.
 */
export function minFontSize(lc: number, weight: Weight): { px: number } | { limit: SizeLimit } {
  const magnitude = Math.abs(lc)
  const index = Math.max(0, Math.min(FONT_LUT.length - 1, Math.floor(magnitude / 5) - 1))
  const px = FONT_LUT[index][weight / 100]

  if (px === PROHIBITED) return { limit: 'none' }
  if (px === NON_TEXT) return { limit: 'non-text' }
  if (magnitude < SPOT_ONLY_BELOW) return { limit: 'spot' }

  // Above 24px the reference rounds to whole pixels and below it keeps half
  // steps; following that exactly is what makes this identical to the reference
  // at every row of the table, and merely conservative between rows.
  return { px: px > 24 ? Math.round(px) : px }
}

const LIMITS: Record<SizeLimit, string> = {
  spot: 'spot only',
  'non-text': 'non-text',
  none: 'no text',
}

export function formatMinFontSize(result: { px: number } | { limit: SizeLimit }): string {
  return 'px' in result ? `${result.px}px` : LIMITS[result.limit]
}
