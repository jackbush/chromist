import { useEffect, useRef, useState } from 'react'
import type { Pin, Settings } from '../types'
import { randomHsl } from '../color'
import { newId } from '../id'
import { load, save } from '../storage'
import { readAudit, readHash, syncHash } from '../urlHash'

/** Dragging in the picker fires changes per pointer event; Safari rate-limits
 *  history.replaceState (~100 calls / 30s) and will throw, so writes are
 *  debounced rather than made on every change. */
const WRITE_DELAY = 250

/** A fresh pin on a random colour — where a first-time user starts. */
export function randomPin(): Pin {
  return { id: newId(), hsl: randomHsl() }
}

/**
 * The starting palette, settings and mode, resolved once. A palette in the URL
 * hash wins over stored pins — a shared link should show the palette it
 * promises, and on the screen it was shared from. There is no empty palette:
 * with nothing to restore, the app opens already holding one pin on a random
 * colour.
 */
export function useInitialState(): { pins: Pin[]; settings: Settings; audit: boolean } {
  const [initial] = useState(() => {
    const stored = load()
    const shared = readHash(window.location.hash)
    const pins = shared ?? stored.pins
    return {
      pins: pins.length > 0 ? pins : [randomPin()],
      settings: stored.settings,
      // Only a link that carries a palette can carry the mode it was read in.
      audit: shared !== null && readAudit(window.location.hash),
    }
  })
  return initial
}

/** Mirrors the live palette into localStorage and the address bar. The mode
 *  rides along in the URL but not into storage: it describes this look at the
 *  palette, not the palette itself. */
export function usePersist(pins: Pin[], settings: Settings, audit: boolean): void {
  const latest = useRef({ pins, settings, audit })
  latest.current = { pins, settings, audit }

  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const { pins, settings, audit } = latest.current
      save({ pins, settings })
      syncHash(pins, audit)
    }, WRITE_DELAY)

    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [pins, settings, audit])

  // A tab closed inside the debounce window would otherwise lose the last edit.
  useEffect(() => {
    const flush = () => save({ pins: latest.current.pins, settings: latest.current.settings })
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])
}
