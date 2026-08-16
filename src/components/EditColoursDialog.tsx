import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Colour, Pin } from '../types'
import { MAX_PINS } from '../types'
import { formatColourList, parseColourList } from '../colourList'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

type Props = {
  pins: Pin[]
  onApply: (colours: Colour[]) => void
  onClose: () => void
}

export function EditColoursDialog({ pins, onApply, onClose }: Props) {
  const [text, setText] = useState(() => formatColourList(pins.map((p) => p.colour)))
  const [overflowed, setOverflowed] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  // The field takes the focus on open, so the keyboard is up for the whole of
  // this dialog's life; the buttons sit above it rather than under it.
  const keyboardInset = useKeyboardInset()

  /** The field is exactly as tall as the palette is long, and holds itself to
   *  that: an eighth line can't be typed, and a longer paste keeps the lines
   *  that fit rather than quietly taking the last seven. */
  const write = (next: string) => {
    const lines = next.split('\n')
    setOverflowed(lines.length > MAX_PINS)
    setText(lines.slice(0, MAX_PINS).join('\n'))
  }

  // The draft is only read on apply, so an unfinished line costs nothing.
  const { colours, errors } = useMemo(() => parseColourList(text), [text])

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    area.focus()
    // Caret at the end rather than over the first code, which a select-all
    // would leave a keystroke away from wiping.
    area.setSelectionRange(area.value.length, area.value.length)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const apply = () => {
    if (errors.length > 0) return
    onApply(colours)
    onClose()
  }

  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-colours-title"
        style={{ '--keyboard-inset': `${keyboardInset}px` } as CSSProperties}
      >
        {/* Everything above the buttons scrolls, so a short screen — a phone
            with the keyboard up — takes it out of the field and the notes
            rather than off the bottom of the dialog. */}
        <div className="dialog-body">
          <div>
            <h2 className="dialog-title" id="edit-colours-title">
              Edit colours
            </h2>
            <p className="dialog-note" id="edit-colours-note">
              List up to {MAX_PINS} colours
            </p>
          </div>

          {/* The numbers are decoration over the field, not content in it: with
              the line count fixed there is nothing to scroll or keep in sync. */}
          <div className="dialog-field">
            <ol className="dialog-lines" aria-hidden="true">
              {Array.from({ length: MAX_PINS }, (_, i) => (
                <li key={i}>{i + 1}</li>
              ))}
            </ol>
            <textarea
              ref={areaRef}
              className="dialog-input"
              value={text}
              rows={MAX_PINS}
              wrap="off"
              onChange={(e) => write(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              aria-label={`Colours, one per line, up to ${MAX_PINS}`}
              aria-describedby="edit-colours-note"
              aria-invalid={errors.length > 0}
              // Enter belongs to the textarea; the modifier commits the lot.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  apply()
                }
              }}
            />
          </div>

          {/* Nothing is dropped silently: every line that can't be read is named
              and blocks the apply until it's fixed, and a paste that ran past the
              end says so. */}
          {(errors.length > 0 || overflowed) && (
            <ul className="dialog-errors" aria-live="polite">
              {overflowed && <li key="over">{MAX_PINS} lines is the lot — the rest was left out</li>}
              {errors.map((err) => (
                <li key={`${err.line}-${err.message}`}>
                  Line {err.line} — {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="dialog-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="dialog-btn is-primary"
            onClick={apply}
            disabled={errors.length > 0}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
