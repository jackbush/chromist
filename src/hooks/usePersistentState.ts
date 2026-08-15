import { useEffect, useRef, useState } from 'react'
import type { Pin, Settings } from '../types'
import { load, save } from '../storage'
import { readHash, syncHash } from '../urlHash'

/** Dragging a slider fires changes per pointer event; Safari rate-limits
 *  history.replaceState (~100 calls / 30s) and will throw, so writes are
 *  debounced rather than made on every change. */
const WRITE_DELAY = 250

/**
 * Pins and settings share one storage record, so they load and save together.
 * A palette in the URL hash wins over stored pins on first paint — a shared
 * link should show the palette it promises.
 */
export function usePersistentState() {
  const [initial] = useState(() => {
    const stored = load()
    const shared = readHash(window.location.hash)
    return { pins: shared ?? stored.pins, settings: stored.settings }
  })

  const [pins, setPins] = useState<Pin[]>(initial.pins)
  const [settings, setSettings] = useState<Settings>(initial.settings)

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

  return { pins, setPins, settings, setSettings }
}
