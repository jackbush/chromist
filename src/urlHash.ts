import type { Pin } from './types'
import { MAX_PINS } from './types'
import { hexToHsl, toBareHex } from './color'
import { newId } from './id'

const HEX = /^[0-9a-f]{6}$/i

/** Reads `#p=aabbcc,ddeeff` into pins. Returns null when there's nothing to load. */
export function readHash(hash: string): Pin[] | null {
  const q = hash.replace(/^#/, '')
  if (!q) return null

  const value = new URLSearchParams(q).get('p')
  if (!value) return null

  const pins = value
    .split(',')
    .filter((h) => HEX.test(h))
    .slice(0, MAX_PINS)
    .map((h) => {
      const hsl = hexToHsl(`#${h}`)
      return hsl ? { id: newId(), hsl } : null
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

/** One spelling of the hash, so the address bar and the share link can never
 *  disagree about what the app is currently showing. */
function hashFor(pins: Pin[], audit: boolean): string {
  if (pins.length === 0) return ''
  const p = pins.map((pin) => toBareHex(pin.hsl)).join(',')
  return `#p=${p}${audit ? '&a=1' : ''}`
}

export function buildShareUrl(pins: Pin[], audit = false): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}${hashFor(pins, audit)}`
}

/** Keeps the address bar in step with the palette without adding history entries. */
export function syncHash(pins: Pin[], audit: boolean): void {
  const next = `${window.location.pathname}${window.location.search}${hashFor(pins, audit)}`
  window.history.replaceState(null, '', next)
}
