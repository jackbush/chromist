import { converter, formatHex } from 'culori'
import type { Colour, Gamut, Pin, Spec, Weight } from './types'
import { GAMUTS, MAX_PINS, WEIGHTS } from './types'
import { isWide, parseColour, toBareHex } from './color'
import { VISIONS, type Vision } from './cvd'
import { newId } from './id'

const HEX = /^[0-9a-f]{6}$/i
const WIDE = /^p3-([0-9a-f]{6})$/i

const toP3 = converter('p3')

/**
 * A colour outside sRGB has no six-digit hex, so it travels as `p3-rrggbb`:
 * the same eight bits per channel, read against Display P3's primaries rather
 * than sRGB's. In-gamut colours keep their bare hex, which is what keeps every
 * link ever shared working and the common URL as short as it was.
 *
 * The share link is the one lossy channel in the app — storage holds the
 * unrounded value, and this quantises. That is the trade a URL short enough to
 * paste into a message is worth.
 */
function encode(colour: Colour): string {
  if (!isWide(colour)) return toBareHex(colour)
  const p3 = toP3({ mode: 'oklab', ...colour })
  const hex = formatHex({ mode: 'rgb', r: p3.r, g: p3.g, b: p3.b })
  return `p3-${(hex ?? '#000000').slice(1)}`
}

function decode(token: string): Colour | null {
  const wide = WIDE.exec(token)
  if (wide) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(wide[1].slice(i, i + 2), 16) / 255)
    return parseColour(`color(display-p3 ${r} ${g} ${b})`)
  }
  return HEX.test(token) ? parseColour(`#${token}`) : null
}

/** Reads `#p=aabbcc,ddeeff` into pins. Returns null when there's nothing to load. */
export function readHash(hash: string): Pin[] | null {
  const q = hash.replace(/^#/, '')
  if (!q) return null

  const value = new URLSearchParams(q).get('p')
  if (!value) return null

  const pins = value
    .split(',')
    .slice(0, MAX_PINS)
    .map((token) => {
      const colour = decode(token)
      return colour ? { id: newId(), colour } : null
    })
    .filter((p): p is Pin => p !== null)

  return pins.length > 0 ? pins : null
}

/** The audit is a mode the app can be in rather than a window over it, so a
 *  link can carry it: `#p=aabbcc,ddeeff&a=1` opens on the grid. */
export function readAudit(hash: string): boolean {
  const q = hash.replace(/^#/, '')
  if (!q) return false
  return new URLSearchParams(q).get('a') === '1'
}

/** And which eye it was read through: `&v=deutan`. Same reasoning as the audit
 *  flag — a finding about a palette is worth sending to someone. */
export function readVision(hash: string): Vision {
  const q = hash.replace(/^#/, '')
  if (!q) return 'normal'
  const v = new URLSearchParams(q).get('v')
  return v && v in VISIONS ? (v as Vision) : 'normal'
}

/**
 * The reading the audit was set to: which spec, and at which font weight. Both
 * are stored settings as well, and a link carrying them wins on load — the same
 * precedence a shared palette already takes over stored pins, so there is one
 * rule rather than two.
 */
export function readSpec(hash: string): Spec | null {
  const w = new URLSearchParams(hash.replace(/^#/, '')).get('w')
  return w === '3' ? 'wcag30' : w === '2' ? 'wcag22' : null
}

export function readGamut(hash: string): Gamut | null {
  const g = new URLSearchParams(hash.replace(/^#/, '')).get('g')
  return g && g in GAMUTS ? (g as Gamut) : null
}

export function readWeight(hash: string): Weight | null {
  const fw = Number(new URLSearchParams(hash.replace(/^#/, '')).get('fw'))
  return WEIGHTS.includes(fw as Weight) ? (fw as Weight) : null
}

/** One spelling of the hash, so the address bar and the share link can never
 *  disagree about what the app is currently showing. */
export type Reading = {
  audit: boolean
  vision: Vision
  spec: Spec
  weight: Weight
  gamut: Gamut
}

function hashFor(pins: Pin[], r: Reading): string {
  if (pins.length === 0) return ''
  const p = pins.map((pin) => encode(pin.colour)).join(',')
  // None of this means anything off the grid, so none of it travels without it.
  const rest = r.audit
    ? [
        '&a=1',
        r.vision !== 'normal' ? `&v=${r.vision}` : '',
        r.spec !== 'wcag22' ? `&w=3` : '',
        r.weight !== 400 ? `&fw=${r.weight}` : '',
        r.gamut !== 'srgb' ? `&g=${r.gamut}` : '',
      ].join('')
    : ''
  return `#p=${p}${rest}`
}

const PLAIN: Reading = {
  audit: false,
  vision: 'normal',
  spec: 'wcag22',
  weight: 400,
  gamut: 'srgb',
}

export function buildShareUrl(pins: Pin[], reading: Partial<Reading> = {}): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}${hashFor(pins, { ...PLAIN, ...reading })}`
}

/** Keeps the address bar in step with the palette without adding history entries. */
export function syncHash(pins: Pin[], reading: Reading): void {
  const next = `${window.location.pathname}${window.location.search}${hashFor(pins, reading)}`
  window.history.replaceState(null, '', next)
}
