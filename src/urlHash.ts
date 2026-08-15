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

export function buildShareUrl(pins: Pin[]): string {
  const { origin, pathname } = window.location
  if (pins.length === 0) return `${origin}${pathname}`
  return `${origin}${pathname}#p=${pins.map((p) => toBareHex(p.hsl)).join(',')}`
}

/** Keeps the address bar in step with the palette without adding history entries. */
export function syncHash(pins: Pin[]): void {
  const hash = pins.length > 0 ? `#p=${pins.map((p) => toBareHex(p.hsl)).join(',')}` : ''
  const next = `${window.location.pathname}${window.location.search}${hash}`
  window.history.replaceState(null, '', next)
}
