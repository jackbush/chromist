import type { Pin, Settings, ThemeName } from './types'
import { MAX_PINS, THEMES } from './types'

const KEY = 'palette-builder.v1'

type Stored = { pins: Pin[]; settings: Settings }

export const DEFAULT_SETTINGS: Settings = { theme: 'black' }

function isHsl(v: unknown): v is Pin['hsl'] {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.h === 'number' &&
    typeof o.s === 'number' &&
    typeof o.l === 'number' &&
    Number.isFinite(o.h) &&
    Number.isFinite(o.s) &&
    Number.isFinite(o.l)
  )
}

/**
 * Anything in localStorage is user-editable and may be from an older build, so
 * every field is validated rather than trusted.
 */
export function load(): Stored {
  const fallback: Stored = { pins: [], settings: DEFAULT_SETTINGS }
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return fallback // Safari private mode and similar
  }
  if (!raw) return fallback

  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const pins = Array.isArray(data.pins)
      ? data.pins
          .filter(
            (p): p is Pin =>
              typeof p === 'object' &&
              p !== null &&
              typeof (p as Pin).id === 'string' &&
              isHsl((p as Pin).hsl),
          )
          .slice(0, MAX_PINS)
      : []

    const s = (data.settings ?? {}) as Record<string, unknown>
    // Records written by older builds may carry extra keys (e.g. `picker`);
    // reading field by field drops them rather than letting them through.
    const theme =
      typeof s.theme === 'string' && s.theme in THEMES
        ? (s.theme as ThemeName)
        : DEFAULT_SETTINGS.theme

    return { pins, settings: { theme } }
  } catch {
    return fallback
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do — the reset still applies to the running app.
  }
}

export function save(data: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Quota or private mode — persistence is a nicety, never block the UI.
  }
}
