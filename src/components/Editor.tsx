import { useEffect, useState } from 'react'
import { HslColorPicker } from 'react-colorful'
import type { Hsl } from '../types'
import { hexToHsl, hslToHex } from '../color'

type Props = {
  colour: Hsl
  onChange: (hsl: Hsl) => void
  onDelete: () => void
}

const COMPLETE = /^#[0-9a-f]{6}$/i

export function Editor({ colour, onChange, onDelete }: Props) {
  const hex = hslToHex(colour).toUpperCase()

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
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          inputMode="text"
          maxLength={7}
          aria-label="Hex code"
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
        <button
          type="button"
          className="editor-delete"
          onClick={onDelete}
          aria-label={`Remove colour ${hex}`}
          title="Remove colour"
        >
          <Trash />
        </button>
      </div>

      <div className="editor-picker">
        <HslColorPicker color={colour} onChange={(c) => onChange({ h: c.h, s: c.s, l: c.l })} />
      </div>
    </section>
  )
}

function Trash() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M10 11v6M14 11v6"
      />
    </svg>
  )
}
