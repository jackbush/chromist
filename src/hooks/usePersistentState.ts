import { useEffect, useRef, useState } from 'react'
import type { Pin, Settings } from '../types'
import { randomHsl } from '../color'
import { newId } from '../id'
import { load, save } from '../storage'
import { readHash, syncHash } from '../urlHash'

/** Dragging in the picker fires changes per pointer event; Safari rate-limits
 *  history.replaceState (~100 calls / 30s) and will throw, so writes are
 *  debounced rather than made on every change. */
const WRITE_DELAY = 250

/** A fresh pin on a random colour — where a first-time user starts. */
export function randomPin(): Pin {
  return { id: newId(), hsl: randomHsl() }
}

/**
 * The starting palette and settings, resolved once. A palette in the URL hash
 * wins over stored pins — a shared link should show the palette it promises.
 * There is no empty palette: with nothing to restore, the app opens already
 * holding one pin on a random colour.
 */
export function useInitialState(): { pins: Pin[]; settings: Settings } {
  const [initial] = useState(() => {
    const stored = load()
    const shared = readHash(window.location.hash)
    const pins = shared ?? stored.pins
    return {
      pins: pins.length > 0 ? pins : [randomPin()],
      settings: stored.settings,
    }
  })
  return initial
}

/** Mirrors the live palette into localStorage and the address bar. */
export function usePersist(pins: Pin[], settings: Settings): void {
  const latest = useRef({ pins, settings })
  latest.current = { pins, settings }

  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      save(latest.current)
      syncHash(latest.current.pins)
    }, WRITE_DELAY)

    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [pins, settings])

  // A tab closed inside the debounce window would otherwise lose the last edit.
  useEffect(() => {
    const flush = () => save(latest.current)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])
}
