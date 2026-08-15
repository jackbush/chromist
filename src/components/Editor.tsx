import { useEffect, useState } from 'react'
import { HslColorPicker } from 'react-colorful'
import type { Hsl } from '../types'
import { hexToHsl, hslToHex } from '../color'

type Props = {
  colour: Hsl | null
  onChange: (hsl: Hsl) => void
}

const COMPLETE = /^#[0-9a-f]{6}$/i

export function Editor({ colour, onChange }: Props) {
  const hex = colour ? hslToHex(colour).toUpperCase() : ''

  // While typing, the field holds text that isn't a colour yet, so it keeps its
  // own value and re-syncs whenever the colour changes from anywhere else.
  const [draft, setDraft] = useState(hex)
  useEffect(() => setDraft(hex), [hex])

  const commitText = (text: string) => {
    const candidate = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`
    if (!COMPLETE.test(candidate)) {
      setDraft(hex) // not a colour — put the real value back
      return
    }
    const next = hexToHsl(candidate)
    if (next) onChange(next)
    else setDraft(hex)
  }

  return (
    <section className="editor" aria-label="Colour editor">
      <div className="editor-bar">
        <input
          type="text"
          className="editor-hex"
          value={draft}
          disabled={!colour}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          inputMode="text"
          maxLength={7}
          aria-label="Hex code"
          placeholder="—"
          onChange={(e) => {
            const text = e.target.value
            setDraft(text)
            // Apply as soon as it's a full hex, so typing feels live.
            const candidate = text.startsWith('#') ? text : `#${text}`
            if (COMPLETE.test(candidate)) {
              const next = hexToHsl(candidate)
              if (next) onChange(next)
            }
          }}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitText(e.currentTarget.value)
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              setDraft(hex)
              e.currentTarget.blur()
            }
          }}
        />
      </div>

      <div className="editor-picker">
        {colour ? (
          <HslColorPicker color={colour} onChange={(c) => onChange({ h: c.h, s: c.s, l: c.l })} />
        ) : (
          <p className="editor-hint">nothing to edit yet</p>
        )}
      </div>
    </section>
  )
}
