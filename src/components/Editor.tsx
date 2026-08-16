import { useEffect, useState } from 'react'
import { HslColorPicker } from 'react-colorful'
import type { Hsl } from '../types'
import { hexToHsl, hslToHex } from '../color'
import { TrashIcon } from './icons'

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

  // iOS scrolls the document to lift a focused field clear of the keyboard.
  // The layout is exactly one viewport tall and has nothing to scroll to, so
  // that only drags the app off screen — put it straight back.
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) return
    const pin = () => window.scrollTo(0, 0)
    pin()
    window.addEventListener('scroll', pin)
    window.visualViewport?.addEventListener('resize', pin)
    return () => {
      window.removeEventListener('scroll', pin)
      window.visualViewport?.removeEventListener('resize', pin)
    }
  }, [focused])

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
          autoCorrect="off"
          autoCapitalize="off"
          inputMode="text"
          // A checkmark rather than a newline: there is nothing to submit and
          // nowhere to go next.
          enterKeyHint="done"
          maxLength={7}
          aria-label="Hex code"
          onFocus={() => setFocused(true)}
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
          onBlur={(e) => {
            setFocused(false)
            commitText(e.target.value)
          }}
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
          <TrashIcon />
        </button>
      </div>

      <div className="editor-picker">
        <HslColorPicker color={colour} onChange={(c) => onChange({ h: c.h, s: c.s, l: c.l })} />
      </div>
    </section>
  )
}

