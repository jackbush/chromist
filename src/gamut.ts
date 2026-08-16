import { clampChroma, converter, formatHex } from 'culori'
import type { Colour, Gamut } from './types'

/**
 * Everything to do with what a screen can actually show.
 *
 * A canonical `Colour` is unbounded, so it can name colours no display can
 * reproduce. Which of them are real depends on the target: sRGB is the safe
 * floor, Display P3 is roughly a quarter wider and is what most current laptops
 * and phones have. The app treats that target as a setting, because it changes
 * the answer to every question below at once.
 */

const toOklab = converter('oklab')
const toOklch = converter('oklch')
const toP3 = converter('p3')

/** culori spells the sRGB gamut `rgb`; ours is named for what a user calls it. */
const SPACE: Record<Gamut, 'rgb' | 'p3'> = { srgb: 'rgb', p3: 'p3' }

const toRgb = converter('rgb')

/**
 * Slack in the gamut test, and it earns its keep.
 *
 * A colour whose channel lands exactly on the boundary — every blue with `r=00`
 * — comes back from a conversion round trip a fraction under zero. Testing
 * strictly then calls it out of gamut and hands it to the chroma mapper, which
 * moves it somewhere visibly different: `#0009be` arrived as `#001fb0`. This is
 * far below half a channel step, so nothing real can hide under it. It also has
 * to clear OKHSL, whose square is fitted to an *approximation* of the sRGB
 * boundary and so overshoots it by up to 8e-6 — a five-hundredth of one channel
 * step, but enough to be called out of gamut by a stricter test.
 */
const EPSILON = 1e-4

export function isInGamut(c: Colour, gamut: Gamut): boolean {
  const lab = { mode: 'oklab', ...c } as const
  // Written out rather than looped: this is the inner loop of the boundary
  // search, and an array plus a closure per call is most of its cost.
  const { r, g, b } = gamut === 'p3' ? toP3(lab) : toRgb(lab)
  return (
    r >= -EPSILON &&
    r <= 1 + EPSILON &&
    g >= -EPSILON &&
    g <= 1 + EPSILON &&
    b >= -EPSILON &&
    b <= 1 + EPSILON
  )
}

/**
 * The nearest showable colour, found by reducing chroma while holding lightness
 * and hue — the whole reason for a perceptual canonical space. Clipping RGB
 * channels instead would shift hue, which is how a clamped blue arrives purple.
 */
export function toGamut(c: Colour, gamut: Gamut): Colour {
  if (isInGamut(c, gamut)) return c
  const clamped = clampChroma({ ...toOklch({ mode: 'oklab', ...c }), mode: 'oklch' }, 'oklch', SPACE[gamut])
  const back = toOklab(clamped)
  return { l: back.l ?? 0, a: back.a ?? 0, b: back.b ?? 0 }
}

/** Six-digit hex, gamut-mapped into sRGB. The lowest common denominator: what
 *  goes in a share link, a paste list, and any CSS fallback. */
export function toHex(c: Colour): string {
  return formatHex({ mode: 'oklab', ...toGamut(c, 'srgb') }) ?? '#000000'
}

/**
 * What to paint with. In-sRGB colours stay hex, because that is what everything
 * understands; anything wider is written as `color(display-p3 …)`, which older
 * browsers ignore — so callers pair it with a hex fallback declaration.
 */
export function toCss(c: Colour, gamut: Gamut = 'p3'): string {
  const fitted = toGamut(c, gamut)
  if (isInGamut(fitted, 'srgb')) return toHex(fitted)

  // Rounded and clamped rather than handed straight to formatCss, which prints
  // whatever the conversion left behind: `color(display-p3 -8.47e-15 1.0000000000000002 …)`
  // for pure P3 green. The tail is float noise from the gamut mapping — the
  // epsilon that keeps a boundary colour in gamut lets it sit a hair outside
  // 0…1 — and five places is an order of magnitude finer than eight bits.
  const { r, g, b } = toP3({ mode: 'oklab', ...fitted })
  const channel = (v: number) => Number(Math.min(1, Math.max(0, v)).toFixed(5))
  return `color(display-p3 ${channel(r)} ${channel(g)} ${channel(b)})`
}

/**
 * A colour as inline style, with its sRGB fallback intact.
 *
 * The usual way to ship wide colour is two declarations, the second ignored by
 * anything that can't read it. React can't emit a duplicate property, so the
 * two values ride as custom properties and the stylesheet picks between them
 * behind `@supports`. Both are set always — `--c-wide` is just the hex again
 * when the colour fits in sRGB — so no rule ever resolves to nothing.
 */
export function cssVars(c: Colour, gamut: Gamut = 'p3'): Record<string, string> {
  return { '--c': toHex(c), '--c-wide': toCss(c, gamut) }
}

/** True when a colour needs more than sRGB to be shown honestly. */
export function isWide(c: Colour): boolean {
  return !isInGamut(c, 'srgb')
}

/** Whether the canvas can hold wide colour. Chrome and Safari can; where it
 *  can't, a P3 square is painted in sRGB and the wide part is unreachable
 *  anyway, so the dead zone tells the truth either way. */
export function canPaintWide(): boolean {
  try {
    const probe = document.createElement('canvas').getContext('2d', { colorSpace: 'display-p3' })
    return probe?.getContextAttributes?.().colorSpace === 'display-p3'
  } catch {
    return false
  }
}

/**
 * The picker square.
 *
 * Two passes, because the fill and the outline want opposite things. The fill is
 * a smooth gradient with no detail to lose, so it is computed small and
 * stretched — the expensive part is one colour conversion per pixel and there is
 * no way around it. The outline is the opposite: a hard edge, where every jagged
 * step shows.
 *
 * Testing each pixel for gamut and leaving the failures transparent gives that
 * jagged edge, and no affordable resolution fixes it — 256² costs 22ms against a
 * 16ms frame, and supersampling it costs four times that. So the outline is not
 * sampled at all. At a fixed hue the reachable region is bounded by one chroma
 * per lightness, which makes the boundary a *curve*: found by bisection along
 * each of a few rows, drawn as a path, and antialiased by the browser for free.
 */

/** Colour fill, upscaled. Small enough to stay inside a frame while dragging. */
const FILL = 128
/** Rows the boundary is sampled at. The curve is gentle apart from one cusp, so
 *  this is plenty to interpolate through and rounds the cusp slightly — which is
 *  wanted, not tolerated. */
const BOUNDARY_ROWS = 128

type SquareMode = {
  x: { min: number; max: number }
  y: { min: number; max: number }
  fromCoords: (co: { x: number; y: number; s: number }) => Colour
  fullSquare: boolean
}

/**
 * The largest x still inside the gamut at this y, as a 0–1 fraction of the axis.
 *
 * Safe to bisect because the region is an interval starting at x.min: the RGB
 * and P3 gamuts are convex, so a ray outward from the neutral axis crosses the
 * boundary exactly once.
 */
function edgeAt(mode: SquareMode, fy: number, slider: number, gamut: Gamut): number {
  const y = mode.y.min + fy * (mode.y.max - mode.y.min)
  const at = (fx: number) =>
    mode.fromCoords({ x: mode.x.min + fx * (mode.x.max - mode.x.min), y, s: slider })

  if (!isInGamut(at(0), gamut)) return 0
  if (isInGamut(at(1), gamut)) return 1

  let lo = 0
  let hi = 1
  // Twelve halvings puts the edge inside a quarter of a device pixel.
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    if (isInGamut(at(mid), gamut)) lo = mid
    else hi = mid
  }
  return lo
}

/** The boundary as a path in canvas coordinates, closed back along the x = 0
 *  edge so it can be filled or clipped. */
function boundaryPath(
  mode: SquareMode,
  slider: number,
  gamut: Gamut,
  w: number,
  h: number,
): Path2D {
  const path = new Path2D()
  for (let i = 0; i <= BOUNDARY_ROWS; i++) {
    const fy = i / BOUNDARY_ROWS
    const x = edgeAt(mode, fy, slider, gamut) * w
    // The square's y axis runs upwards; the canvas's runs down.
    const y = (1 - fy) * h
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.lineTo(0, 0)
  path.lineTo(0, h)
  path.closePath()
  return path
}

let scratch: HTMLCanvasElement | null = null

/** The gradient itself, computed small. Out-of-gamut pixels are left to clip
 *  per channel — they sit outside the clip region and are never seen. */
function fill(mode: SquareMode, slider: number, wide: boolean): HTMLCanvasElement {
  scratch ??= document.createElement('canvas')
  scratch.width = FILL
  scratch.height = FILL
  const ctx = scratch.getContext('2d', wide ? { colorSpace: 'display-p3' } : undefined)
  if (!ctx) return scratch

  const data = new Uint8ClampedArray(FILL * FILL * 4)
  for (let py = 0; py < FILL; py++) {
    const y = mode.y.min + ((FILL - 1 - py) / (FILL - 1)) * (mode.y.max - mode.y.min)
    for (let px = 0; px < FILL; px++) {
      const x = mode.x.min + (px / (FILL - 1)) * (mode.x.max - mode.x.min)
      const lab = { mode: 'oklab', ...mode.fromCoords({ x, y, s: slider }) } as const
      const { r, g, b } = wide ? toP3(lab) : toRgb(lab)
      const i = (py * FILL + px) * 4
      data[i] = r * 255
      data[i + 1] = g * 255
      data[i + 2] = b * 255
      data[i + 3] = 255
    }
  }
  ctx.putImageData(
    wide
      ? new ImageData(data, FILL, FILL, { colorSpace: 'display-p3' })
      : new ImageData(data, FILL, FILL),
    0,
    0,
  )
  return scratch
}

/**
 * The sRGB edge is marked in the opposite hue at middling lightness and high
 * chroma. A neutral line cannot work here: it has to cross the whole lightness
 * axis, so any grey disappears against one end of it. The opposite hue is the
 * one colour guaranteed to be unlike everything the square is showing.
 */
function markerColour(slider: number): string {
  return toHex(
    toOklab({ mode: 'oklch', l: 0.62, c: 0.2, h: (slider + 180) % 360 }) as unknown as Colour,
  )
}

export function paintSquare(
  ctx: CanvasRenderingContext2D,
  mode: SquareMode,
  slider: number,
  gamut: Gamut,
  scale = 1,
): void {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const wide = gamut === 'p3' && ctx.getContextAttributes?.().colorSpace === 'display-p3'
  const tile = fill(mode, slider, wide)

  ctx.clearRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true

  if (mode.fullSquare) {
    ctx.drawImage(tile, 0, 0, w, h)
    return
  }

  // putImageData ignores the clip, which is the reason the fill is drawn from a
  // second canvas rather than written straight in.
  ctx.save()
  ctx.clip(boundaryPath(mode, slider, gamut, w, h))
  ctx.drawImage(tile, 0, 0, w, h)
  ctx.restore()

  // Where the picker reaches past sRGB, mark how far sRGB got. Drawn inside the
  // reachable area so it reads as a division of it rather than a second border.
  if (gamut === 'p3') {
    ctx.save()
    ctx.clip(boundaryPath(mode, slider, 'p3', w, h))
    ctx.strokeStyle = markerColour(slider)
    ctx.lineWidth = scale
    ctx.setLineDash([4 * scale, 4 * scale])
    ctx.stroke(boundaryPath(mode, slider, 'srgb', w, h))
    ctx.restore()
  }
}

