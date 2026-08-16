import { useCallback, useEffect, useRef, useState } from 'react'
import type { Gamut } from '../types'
import type { Coords, Mode } from '../modes'
import { isInGamut, paintSquare, toCss } from '../gamut'
import { InfoIcon } from './icons'

/**
 * The square and the slider, for every mode.
 *
 * Coordinates are owned by the caller and handed down, which is what makes a
 * drag survive the gamut: pushing chroma past the edge clamps the *colour* but
 * not the position, so pulling back returns where you started. It is also what
 * keeps a hue while dragging through grey, where the colour itself has none.
 */

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

type Props = {
  coords: Coords
  mode: Mode
  gamut: Gamut
  onCoords: (co: Coords) => void
  /** Shown over the square's bottom corner — where the space itself is what is
   *  being remarked on, not the control around it. */
  note?: string
}

/**
 * Pointer drag shared by both controls: capture on down, report a 0–1 position
 * within the element until release.
 *
 * `canStart` gates the press, not the drag. A press on part of the square that
 * isn't a colour does nothing at all — no capture, no selection — while a drag
 * that began on a colour keeps running wherever it wanders, so it can still be
 * pushed against the edge of the space and held there.
 */
function useDrag(
  onMove: (fx: number, fy: number) => void,
  canStart?: (fx: number, fy: number) => boolean,
) {
  const ref = useRef<HTMLDivElement>(null)

  const at = useCallback((e: { clientX: number; clientY: number }) => {
    const el = ref.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      fx: clamp((e.clientX - r.left) / r.width, 0, 1),
      fy: clamp((e.clientY - r.top) / r.height, 0, 1),
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const p = at(e)
      if (!p || (canStart && !canStart(p.fx, p.fy))) return
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.focus()
      onMove(p.fx, p.fy)
    },
    [at, canStart, onMove],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const p = at(e)
      if (p) onMove(p.fx, p.fy)
    },
    [at, onMove],
  )

  return { ref, onPointerDown, onPointerMove }
}

export function ChannelPicker({ coords, mode, gamut, onCoords, note }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  const onSquare = useCallback(
    (fx: number, fy: number) =>
      onCoords({
        ...coords,
        x: mode.x.min + fx * (mode.x.max - mode.x.min),
        y: mode.y.max - fy * (mode.y.max - mode.y.min),
      }),
    [coords, mode, onCoords],
  )

  const onSlider = useCallback(
    (fx: number) => onCoords({ ...coords, s: fx * mode.slider.max }),
    [coords, mode, onCoords],
  )

  /** Only where there is a colour to pick. The unreachable part of the square is
   *  the theme's own background showing through, and pressing it used to select
   *  whatever the nearest real colour happened to be — near-black, in the corner
   *  the "outside sRGB" mark sits in. */
  const startsOnColour = useCallback(
    (fx: number, fy: number) => {
      if (mode.fullSquare) return true
      return isInGamut(
        mode.fromCoords({
          ...coords,
          x: mode.x.min + fx * (mode.x.max - mode.x.min),
          y: mode.y.max - fy * (mode.y.max - mode.y.min),
        }),
        gamut,
      )
    },
    [coords, mode, gamut],
  )

  const square = useDrag(onSquare, startsOnColour)
  const slider = useDrag(onSlider)

  /**
   * The canvas is sized to the pixels it will actually occupy, device pixels and
   * all.
   *
   * A fixed backing store stretched to fit was the cause of the soft edge: the
   * boundary is one device pixel wide when drawn and three or four once the
   * browser has scaled it up. Nothing about the fill needs this — it is a
   * gradient — but the line does, and the line is the part anyone looks at.
   */
  const [box, setBox] = useState({ w: 0, h: 0, scale: 1 })
  useEffect(() => {
    const el = square.ref.current
    if (!el) return
    const measure = () => {
      const scale = window.devicePixelRatio || 1
      const r = el.getBoundingClientRect()
      setBox((was) => {
        const w = Math.max(1, Math.round(r.width * scale))
        const h = Math.max(1, Math.round(r.height * scale))
        return was.w === w && was.h === h && was.scale === scale ? was : { w, h, scale }
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [square.ref])

  // Repaint on hue, mode, target or size — never on x/y, which only move the
  // pointer over a square that hasn't changed.
  useEffect(() => {
    const el = canvas.current
    if (!el || box.w === 0) return
    const ctx = el.getContext('2d', gamut === 'p3' ? { colorSpace: 'display-p3' } : undefined)
    if (!ctx) return
    const frame = requestAnimationFrame(() => paintSquare(ctx, mode, coords.s, gamut, box.scale))
    return () => cancelAnimationFrame(frame)
  }, [coords.s, mode, gamut, box])

  const nudge = (e: React.KeyboardEvent, axes: 'xy' | 's') => {
    const big = e.shiftKey ? 10 : 1
    const stepX = ((mode.x.max - mode.x.min) / 100) * big
    const stepY = ((mode.y.max - mode.y.min) / 100) * big
    const stepS = big
    let next: Coords | null = null

    if (axes === 's') {
      if (e.key === 'ArrowLeft') next = { ...coords, s: coords.s - stepS }
      if (e.key === 'ArrowRight') next = { ...coords, s: coords.s + stepS }
      if (next) next.s = (next.s + 360) % 360
    } else {
      if (e.key === 'ArrowLeft') next = { ...coords, x: coords.x - stepX }
      if (e.key === 'ArrowRight') next = { ...coords, x: coords.x + stepX }
      if (e.key === 'ArrowDown') next = { ...coords, y: coords.y - stepY }
      if (e.key === 'ArrowUp') next = { ...coords, y: coords.y + stepY }
      if (next) {
        next.x = clamp(next.x, mode.x.min, mode.x.max)
        next.y = clamp(next.y, mode.y.min, mode.y.max)
      }
    }
    if (!next) return
    e.preventDefault()
    onCoords(next)
  }

  // The track is hue swept at the colour's own x and y, so it shows what the
  // slider will actually do — outside HSL it is nothing like a rainbow.
  const track = Array.from({ length: 25 }, (_, i) => {
    const h = (i / 24) * 360
    return `${toCss(mode.fromCoords({ ...coords, s: h }), gamut)} ${(i / 24) * 100}%`
  }).join(', ')

  const fx = ((coords.x - mode.x.min) / (mode.x.max - mode.x.min)) * 100
  const fy = ((mode.y.max - coords.y) / (mode.y.max - mode.y.min)) * 100
  const value = (n: number, a: { precision: number }) => n.toFixed(a.precision)

  return (
    <div className="picker">
      <div
        className="picker-square"
        ref={square.ref}
        onPointerDown={square.onPointerDown}
        onPointerMove={square.onPointerMove}
        onKeyDown={(e) => nudge(e, 'xy')}
        tabIndex={0}
        role="slider"
        aria-label={`${mode.x.label} and ${mode.y.label}`}
        aria-valuetext={`${mode.x.label} ${value(coords.x, mode.x)}, ${mode.y.label} ${value(coords.y, mode.y)}`}
        aria-valuenow={coords.y}
        aria-valuemin={mode.y.min}
        aria-valuemax={mode.y.max}
      >
        {/* Keyed on the gamut: a canvas keeps whatever context it was first
            given, so asking the same element for a P3 one later hands back the
            sRGB context it already has. Remounting is the only way to change
            it. */}
        <canvas
          key={gamut}
          ref={canvas}
          width={box.w}
          height={box.h}
          aria-hidden="true"
        />
        <div className="picker-pointer" style={{ left: `${fx}%`, top: `${fy}%` }} />
        {note && (
          <p className="picker-note" role="status">
            <InfoIcon size={12} />
            {note}
          </p>
        )}
      </div>

      <div
        className="picker-slider"
        ref={slider.ref}
        onPointerDown={slider.onPointerDown}
        onPointerMove={slider.onPointerMove}
        onKeyDown={(e) => nudge(e, 's')}
        tabIndex={0}
        role="slider"
        aria-label={mode.slider.label === 'H' ? 'Hue' : mode.slider.label}
        aria-valuenow={Math.round(coords.s)}
        aria-valuemin={0}
        // The mode's own range. Hardcoding 360 was right for hue and wrong for
        // every other slider, and a screen reader reads the percentage it works
        // out from these — so it was announcing the wrong number.
        aria-valuemax={mode.slider.max}
        aria-valuetext={`${mode.slider.label === 'H' ? 'Hue' : mode.slider.label} ${Math.round(coords.s)}`}
        style={{ backgroundImage: `linear-gradient(to right, ${track})` }}
      >
        <div className="picker-pointer" style={{ left: `${(coords.s / 360) * 100}%`, top: '50%' }} />
      </div>
    </div>
  )
}
