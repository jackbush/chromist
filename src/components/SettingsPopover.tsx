import { useEffect, useRef, useState } from 'react'
import type { PickerStyle, Pin, Settings, ThemeName } from '../types'
import { PICKER_LABELS, THEMES } from '../types'
import { buildShareUrl } from '../urlHash'
import { copy } from '../clipboard'

type Props = {
  pins: Pin[]
  settings: Settings
  onChange: (settings: Settings) => void
}

const THEME_ORDER: ThemeName[] = ['neutral', 'black', 'white']
const PICKER_ORDER: PickerStyle[] = ['sliders', 'square', 'wheel']

export function SettingsPopover({ pins, settings, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shared, setShared] = useState(false)

  // Move focus in on open so Escape and tabbing behave like a real dialog.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus()
  }, [])

  return (
    <div className="popover" role="dialog" aria-label="Settings" ref={ref}>
      <fieldset className="popover-group">
        <legend>Theme</legend>
        <div className="popover-options">
          {THEME_ORDER.map((name) => (
            <button
              key={name}
              type="button"
              className={`opt${settings.theme === name ? ' is-active' : ''}`}
              aria-pressed={settings.theme === name}
              onClick={() => onChange({ ...settings, theme: name })}
            >
              {THEMES[name].label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="popover-group">
        <legend>Colour picker</legend>
        <div className="popover-options">
          {PICKER_ORDER.map((style) => (
            <button
              key={style}
              type="button"
              className={`opt${settings.picker === style ? ' is-active' : ''}`}
              aria-pressed={settings.picker === style}
              onClick={() => onChange({ ...settings, picker: style })}
            >
              {PICKER_LABELS[style]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="popover-group">
        <legend>Palette</legend>
        <button
          type="button"
          className="opt opt-wide"
          disabled={pins.length === 0}
          onClick={async () => {
            const ok = await copy(buildShareUrl(pins))
            setShared(ok)
            window.setTimeout(() => setShared(false), 1200)
          }}
        >
          {shared ? 'link copied' : 'copy share link'}
        </button>
      </fieldset>
    </div>
  )
}
