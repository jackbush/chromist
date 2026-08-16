import { useEffect, useRef } from 'react'
import type { Settings, ThemeName } from '../types'
import { THEMES } from '../types'

type Props = {
  settings: Settings
  onChange: (settings: Settings) => void
}

const THEME_ORDER: ThemeName[] = ['black', 'neutral', 'white']

export function SettingsPopover({ settings, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)

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
    </div>
  )
}
