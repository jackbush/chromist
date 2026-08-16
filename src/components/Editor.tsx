import { useEffect, useRef, useState } from 'react'
import type { Colour, ModeId } from '../types'
import type { Coords } from '../modes'
import { gamutFor, MODES, modeById } from '../modes'
import { colourEquals, isWide, parseColour, toGamut, toHex } from '../color'
import { COPIED_MS, copy } from '../clipboard'
import { ChannelPicker } from './ChannelPicker'
import { ClipboardIcon } from './icons'

type Props = {
  colour: Colour
  mode: ModeId
  onChange: (colour: Colour) => void
  onModeChange: (mode: ModeId) => void
}

export function Editor({ colour, mode: modeId, onChange, onModeChange }: Props) {
  const mode = modeById(modeId)
  const gamut = gamutFor(mode)

  /**
   * Picker coordinates while a drag is in progress.
   *
   * The canonical colour cannot carry them: a colour that has been fitted to the
   * gamut has forgotten where the pointer was, so a drag past the edge would
   * stick there instead of coming back, and a drag through grey would lose its
   * hue. Held here until the colour changes from somewhere else — the same
   * arrangement the text field below uses for half-typed input.
   */
  const [live, setLive] = useState<Coords | null>(null)
  const sent = useRef<Colour | null>(null)

  useEffect(() => {
    if (!sent.current || !colourEquals(colour, sent.current)) setLive(null)
  }, [colour])

  useEffect(() => setLive(null), [modeId])

  const hue = useRef(0)
  const coords = live ?? mode.toCoords(colour, hue.current)
  useEffect(() => {
    hue.current = coords.s
  }, [coords.s])

  /**
   * The ring is placed from the colour that was actually reached, not from where
   * the pointer went. Dragging past the edge of the space would otherwise leave
   * it stranded over a colour that cannot exist, and let go somewhere different
   * from where it looked — so it rides the boundary instead, exactly where it
   * would sit if you left this swatch and came back to it.
   *
   * The hue is taken from the drag rather than read back, because a colour on
   * the neutral axis hasn't got one to read.
   */
  const handleCoords = (next: Coords) => {
    const fitted = toGamut(mode.fromCoords(next), gamut)
    sent.current = fitted
    setLive(mode.toCoords(fitted, next.s))
    onChange(fitted)
  }

  // What the field shows: the mode's own CSS notation where it has one, and hex
  // where it doesn't — see `format` in modes.ts.
  const text = mode.format ? mode.format(colour, coords) : toHex(colour).toUpperCase()

  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)
  const handleCopy = async () => {
    await copy(text)
    setCopied(true)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }

  const [draft, setDraft] = useState(text)
  useEffect(() => setDraft(text), [text])

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

  /** Anything culori can read is accepted, whatever the current mode: a hex
   *  code, `oklch(…)`, `color(display-p3 …)`. The mode decides what is written
   *  back out, not what may be typed in. */
  const commitText = (value: string) => {
    const next = parseColour(value.trim().match(/^[0-9a-f]{3,6}$/i) ? `#${value.trim()}` : value)
    if (!next) {
      setDraft(text) // not a colour — put the real value back
      return
    }
    const fitted = toGamut(next, gamut)
    sent.current = fitted
    setLive(null)
    onChange(fitted)
  }

  const wide = isWide(colour)

  return (
    <section className="editor" aria-label="Colour editor">
      {/* One control, read left to right: the space, the value in it, and a way
          to take that value away with you. */}
      <div className="editor-bar">
        <div className="editor-value">
          <select
            className="editor-mode"
            value={modeId}
            // The select is controlled, and the change can be refused upstream
            // — a palette with wide colours in it asks first. A refusal moves
            // nothing in state, so nothing re-renders to put the DOM back;
            // restoring it here costs nothing when the change does go through.
            onChange={(e) => {
              const chosen = e.target.value as ModeId
              e.target.value = modeId
              onModeChange(chosen)
            }}
            aria-label="Colour space"
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

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
            aria-label={`Colour value, ${mode.format ? mode.label : 'hex'}`}
            onFocus={() => setFocused(true)}
            onChange={(e) => setDraft(e.target.value)}
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
                setDraft(text)
                e.currentTarget.blur()
              }
            }}
          />

          <button
            type="button"
            className={`editor-copy${copied ? ' is-copied' : ''}`}
            onClick={handleCopy}
            aria-label={`Copy ${text}`}
            title="Copy this value"
          >
            <ClipboardIcon size={14} />
          </button>
        </div>
      </div>

      <div className="editor-picker">
        {/* Handed to the picker rather than placed over this pane: the slider's
            height changes with the layout, so anything positioned from the
            bottom of the pane lands on top of it. */}
        <ChannelPicker
          coords={coords}
          mode={mode}
          gamut={gamut}
          onCoords={handleCoords}
          note={wide ? 'Outside sRGB' : undefined}
        />
      </div>
    </section>
  )
}
