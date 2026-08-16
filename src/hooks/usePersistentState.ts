import { useEffect, useRef, useState } from 'react'
import type { Pin, Settings } from '../types'
import { randomColour } from '../color'
import { newId } from '../id'
import { load, save } from '../storage'
import {
  readAudit,
  readGamut,
  readHash,
  readSpec,
  readVision,
  readWeight,
  syncHash,
} from '../urlHash'
import type { Reading } from '../urlHash'
import type { Vision } from '../cvd'

/** Dragging in the picker fires changes per pointer event; Safari rate-limits
 *  history.replaceState (~100 calls / 30s) and will throw, so writes are
 *  debounced rather than made on every change. */
const WRITE_DELAY = 250

/** A fresh pin on a random colour — where a first-time user starts. */
export function randomPin(): Pin {
  return { id: newId(), colour: randomColour() }
}

/**
 * The starting palette, settings and mode, resolved once. A palette in the URL
 * hash wins over stored pins — a shared link should show the palette it
 * promises, and on the screen it was shared from. There is no empty palette:
 * with nothing to restore, the app opens already holding one pin on a random
 * colour.
 */
export function useInitialState(): {
  pins: Pin[]
  settings: Settings
  audit: boolean
  vision: Vision
} {
  const [initial] = useState(() => {
    const stored = load()
    const hash = window.location.hash
    const shared = readHash(hash)
    const pins = shared ?? stored.pins
    // Only a link that carries a palette can carry the mode it was read in.
    const carried = shared !== null
    return {
      pins: pins.length > 0 ? pins : [randomPin()],
      // The spec and weight are stored settings too, and a link carrying them
      // wins — the same precedence the palette above already takes.
      settings: {
        ...stored.settings,
        spec: (carried && readSpec(hash)) || stored.settings.spec,
        weight: (carried && readWeight(hash)) || stored.settings.weight,
        gamut: (carried && readGamut(hash)) || stored.settings.gamut,
      },
      audit: carried && readAudit(hash),
      vision: carried ? readVision(hash) : ('normal' as Vision),
    }
  })
  return initial
}

/** Mirrors the live palette into localStorage and the address bar. The mode
 *  rides along in the URL but not into storage: it describes this look at the
 *  palette, not the palette itself. */
export function usePersist(
  pins: Pin[],
  settings: Settings,
  audit: boolean,
  vision: Vision,
): void {
  const latest = useRef({ pins, settings, audit, vision })
  latest.current = { pins, settings, audit, vision }

  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const { pins, settings, audit, vision } = latest.current
      save({ pins, settings })
      const reading: Reading = {
        audit,
        vision,
        spec: settings.spec,
        weight: settings.weight,
        gamut: settings.gamut,
      }
      syncHash(pins, reading)
    }, WRITE_DELAY)

    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [pins, settings, audit, vision])

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
