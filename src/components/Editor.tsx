import { useCallback, useRef, useState } from 'react'
import { HslColorPicker } from 'react-colorful'
import type { Hsl, PickerStyle } from '../types'
import { hslToHex } from '../color'
import { copy } from '../clipboard'
import { Sliders } from './Sliders'
import { Wheel } from './Wheel'

type Props = {
  colour: Hsl
  picker: PickerStyle
  mode: 'new' | 'pin'
  isDirty: boolean
  atCapacity: boolean
  onChange: (hsl: Hsl) => void
  onPin: () => void
  onRevert: () => void
}

export function Editor({
  colour,
  picker,
  mode,
  isDirty,
  atCapacity,
  onChange,
  onPin,
  onRevert,
}: Props) {
  const hex = hslToHex(colour).toUpperCase()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  const handleCopy = useCallback(async () => {
    await copy(hex)
    setCopied(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 200)
  }, [hex])

  return (
    <section className="editor" aria-label="Colour editor">
      <div className="editor-head">
        <button
          type="button"
          className={`editor-hex${copied ? ' is-copied' : ''}`}
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          {hex}
        </button>
        <span className="editor-preview" style={{ background: hslToHex(colour) }} aria-hidden />
      </div>

      <div className="editor-picker">
        {picker === 'sliders' && <Sliders colour={colour} onChange={onChange} />}
        {picker === 'wheel' && <Wheel colour={colour} onChange={onChange} />}
        {picker === 'square' && (
          <HslColorPicker color={colour} onChange={(c) => onChange({ h: c.h, s: c.s, l: c.l })} />
        )}
      </div>

      <div className="editor-actions">
        {mode === 'new' ? (
          <button type="button" className="btn" onClick={onPin} disabled={atCapacity}>
            {atCapacity ? 'full' : 'pin'}
          </button>
        ) : (
          <button type="button" className="btn" onClick={onRevert} disabled={!isDirty}>
            {isDirty ? 'revert' : 'pinned'}
          </button>
        )}
      </div>
    </section>
  )
}
