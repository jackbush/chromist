import type { Hsl } from '../types'

type Props = { colour: Hsl; onChange: (hsl: Hsl) => void }

/**
 * Native range inputs: touch handling, keyboard support and accessibility come
 * for free, which no hand-rolled track matches.
 */
export function Sliders({ colour, onChange }: Props) {
  const { h, s, l } = colour

  const hueTrack =
    'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), ' +
    'hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))'
  const satTrack = `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))`
  const lightTrack = `linear-gradient(to right, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))`

  return (
    <div className="sliders">
      <Slider
        label="H"
        value={h}
        max={360}
        track={hueTrack}
        onChange={(v) => onChange({ ...colour, h: v })}
      />
      <Slider
        label="S"
        value={s}
        max={100}
        track={satTrack}
        onChange={(v) => onChange({ ...colour, s: v })}
      />
      <Slider
        label="L"
        value={l}
        max={100}
        track={lightTrack}
        onChange={(v) => onChange({ ...colour, l: v })}
      />
    </div>
  )
}

type SliderProps = {
  label: string
  value: number
  max: number
  track: string
  onChange: (value: number) => void
}

function Slider({ label, value, max, track, onChange }: SliderProps) {
  // The stored value carries sub-integer precision; the control shows whole numbers.
  const shown = Math.round(value)
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        value={shown}
        style={{ backgroundImage: track }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <span className="slider-value">{String(shown).padStart(3, ' ')}</span>
    </label>
  )
}
