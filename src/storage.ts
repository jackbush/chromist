import { converter } from 'culori'
import type { Colour, Gamut, ModeId, Pin, Settings, Spec, ThemeName, Weight } from './types'
import { GAMUTS, MAX_PINS, SPECS, THEMES, WEIGHTS } from './types'
import { DEFAULT_MODE, MODES } from './modes'

const KEY = 'chromist.v2'
/** Pins as HSL triples, which is what every build before colour modes wrote. */
const KEY_V1 = 'chromist.v1'

type Stored = { pins: Pin[]; settings: Settings }

export const DEFAULT_SETTINGS: Settings = {
  theme: 'white',
  mode: DEFAULT_MODE,
  spec: 'wcag22',
  weight: 400,
  gamut: 'srgb',
}

const toOklab = converter('oklab')

function isColour(v: unknown): v is Colour {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (['l', 'a', 'b'] as const).every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]))
}

function readPins(raw: unknown, pick: (p: Record<string, unknown>) => Colour | null): Pin[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      if (typeof p !== 'object' || p === null) return null
      const o = p as Record<string, unknown>
      if (typeof o.id !== 'string') return null
      const colour = pick(o)
      return colour ? { id: o.id, colour } : null
    })
    .filter((p): p is Pin => p !== null)
    .slice(0, MAX_PINS)
}

/**
 * Anything in localStorage is user-editable and may be from an older build, so
 * every field is validated rather than trusted.
 */
export function load(): Stored {
  const fallback: Stored = { pins: [], settings: DEFAULT_SETTINGS }
  let raw: string | null = null
  let migrating = false
  try {
    raw = localStorage.getItem(KEY)
    if (!raw) {
      raw = localStorage.getItem(KEY_V1)
      migrating = raw !== null
    }
  } catch {
    return fallback // Safari private mode and similar
  }
  if (!raw) return fallback

  try {
    const data = JSON.parse(raw) as Record<string, unknown>

    // v1 stored `hsl: {h,s,l}`; v2 stores `colour: {l,a,b}`. The conversion is
    // exact, so a palette carried across is the same palette.
    const pins = migrating
      ? readPins(data.pins, (o) => {
          const h = o.hsl as Record<string, unknown> | undefined
          if (!h || !['h', 's', 'l'].every((k) => typeof h[k] === 'number' && Number.isFinite(h[k])))
            return null
          const c = toOklab({
            // The space v1 stored in, which has nothing to do with the space
            // the editor happens to open in.
            mode: 'hsl',
            h: h.h as number,
            s: (h.s as number) / 100,
            l: (h.l as number) / 100,
          })
          return c ? { l: c.l ?? 0, a: c.a ?? 0, b: c.b ?? 0 } : null
        })
      : readPins(data.pins, (o) => (isColour(o.colour) ? o.colour : null))

    const s = (data.settings ?? {}) as Record<string, unknown>
    // Records written by older builds may carry extra keys (e.g. `picker`);
    // reading field by field drops them rather than letting them through.
    const theme =
      typeof s.theme === 'string' && s.theme in THEMES
        ? (s.theme as ThemeName)
        : DEFAULT_SETTINGS.theme
    const mode =
      typeof s.mode === 'string' && MODES.some((m) => m.id === s.mode)
        ? (s.mode as ModeId)
        : DEFAULT_SETTINGS.mode

    const spec =
      typeof s.spec === 'string' && s.spec in SPECS ? (s.spec as Spec) : DEFAULT_SETTINGS.spec
    const weight = WEIGHTS.includes(s.weight as Weight)
      ? (s.weight as Weight)
      : DEFAULT_SETTINGS.weight
    const gamut =
      typeof s.gamut === 'string' && s.gamut in GAMUTS ? (s.gamut as Gamut) : DEFAULT_SETTINGS.gamut

    return { pins, settings: { theme, mode, spec, weight, gamut } }
  } catch {
    return fallback
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(KEY_V1)
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
