import { useCallback, useRef } from 'react'
import type { Hsl } from '../types'

type Props = { colour: Hsl; onChange: (hsl: Hsl) => void }

const RAD = Math.PI / 180

/**
 * react-colorful ships square-and-hue-bar pickers only, so the wheel is
 * hand-built: angle around the disc is hue, distance from centre is
 * saturation, and lightness stays on its own slider.
 */
export function Wheel({ colour, onChange }: Props) {
  const discRef = useRef<HTMLDivElement>(null)

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const rect = discRef.current?.getBoundingClientRect()
      if (!rect) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = clientX - cx
      const dy = clientY - cy

      // conic-gradient starts at 12 o'clock and runs clockwise; match it.
      const angle = (Math.atan2(dx, -dy) / RAD + 360) % 360
      const radius = Math.min(rect.width, rect.height) / 2
      const distance = Math.min(1, Math.hypot(dx, dy) / radius)

      onChange({ ...colour, h: Math.round(angle), s: Math.round(distance * 100) })
    },
    [colour, onChange],
  )

  const markerAngle = colour.h * RAD
  const reach = colour.s / 2 // percent of the disc's half-width

  return (
    <div className="wheel">
      <div
        ref={discRef}
        className="wheel-disc"
        role="button"
        tabIndex={0}
        aria-label="Hue and saturation wheel"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          apply(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) apply(e.clientX, e.clientY)
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        <span
          className="wheel-marker"
          style={{
            left: `${50 + Math.sin(markerAngle) * reach}%`,
            top: `${50 - Math.cos(markerAngle) * reach}%`,
            background: `hsl(${colour.h} ${colour.s}% ${colour.l}%)`,
          }}
        />
      </div>

      <label className="slider">
        <span className="slider-label">L</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(colour.l)}
          style={{
            backgroundImage: `linear-gradient(to right, hsl(${colour.h} ${colour.s}% 0%), hsl(${colour.h} ${colour.s}% 50%), hsl(${colour.h} ${colour.s}% 100%))`,
          }}
          onChange={(e) => onChange({ ...colour, l: Number(e.target.value) })}
          aria-label="Lightness"
        />
        <span className="slider-value">{String(Math.round(colour.l)).padStart(3, ' ')}</span>
      </label>
    </div>
  )
}
