import { useCallback, useRef, useState } from 'react'
import type { Pin } from '../types'
import { hslToCss, hslToHex } from '../color'
import { copy } from '../clipboard'
import { useIsDesktop } from '../hooks/useIsDesktop'

type Props = {
  pins: Pin[]
  selectedId: string | null
  showAdd: boolean
  isAdding: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onReorder: (from: number, to: number) => void
}

const DRAG_THRESHOLD = 8

export function PinnedPane({
  pins,
  selectedId,
  showAdd,
  isAdding,
  onSelect,
  onNew,
  onDelete,
  onReorder,
}: Props) {
  const isDesktop = useIsDesktop()
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const drag = useRef<{ id: string; index: number; x: number; y: number; moved: boolean } | null>(
    null,
  )
  const flashTimer = useRef<number | null>(null)

  const handleCopy = useCallback(async (pin: Pin) => {
    await copy(hslToHex(pin.hsl))
    // Silent, as specified — the only feedback is a brief flash of the cell.
    setCopied(pin.id)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setCopied(null), 200)
  }, [])

  const columnCount = pins.length + (showAdd ? 1 : 0)

  const targetIndex = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || columnCount === 0) return 0
      const size = (isDesktop ? rect.height : rect.width) / columnCount
      const pos = isDesktop ? clientY - rect.top : clientX - rect.left
      const idx = Math.floor(pos / size)
      return Math.max(0, Math.min(pins.length - 1, idx))
    },
    [columnCount, isDesktop, pins.length],
  )

  const onPointerDown = (e: React.PointerEvent, pin: Pin, index: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    drag.current = { id: pin.id, index, x: e.clientX, y: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return

    if (!d.moved) {
      const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y)
      if (dist < DRAG_THRESHOLD) return
      d.moved = true
      setDraggingId(d.id)
    }

    const to = targetIndex(e.clientX, e.clientY)
    if (to !== d.index) {
      onReorder(d.index, to)
      d.index = to
    }
  }

  const onPointerUp = (e: React.PointerEvent, pin: Pin) => {
    const d = drag.current
    drag.current = null
    setDraggingId(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    // A press that never became a drag is a plain selection.
    if (d && !d.moved) onSelect(pin.id)
  }

  return (
    <section className="pins" aria-label="Pinned colours">
      <div className="pins-track" ref={containerRef}>
        {pins.length === 0 && (
          <div className="pins-empty">
            <p>pin a colour to get started</p>
          </div>
        )}

        {pins.map((pin, index) => {
          const hex = hslToHex(pin.hsl)
          const selected = pin.id === selectedId
          return (
            <div
              key={pin.id}
              className={`pin${selected ? ' is-selected' : ''}${
                draggingId === pin.id ? ' is-dragging' : ''
              }`}
            >
              <button
                type="button"
                className={`pin-hex${copied === pin.id ? ' is-copied' : ''}`}
                onClick={() => handleCopy(pin)}
                title="Copy to clipboard"
              >
                {hex.toUpperCase()}
              </button>
              <div
                className="pin-swatch"
                style={{ background: hslToCss(pin.hsl) }}
                role="button"
                tabIndex={0}
                aria-label={`Edit colour ${hex}`}
                aria-pressed={selected}
                onPointerDown={(e) => onPointerDown(e, pin, index)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(e, pin)}
                onPointerCancel={() => {
                  drag.current = null
                  setDraggingId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(pin.id)
                  }
                }}
              >
                {selected && (
                  <button
                    type="button"
                    className="pin-delete"
                    aria-label={`Remove colour ${hex}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(pin.id)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {showAdd && (
          <div className={`pin pin-add${isAdding ? ' is-selected' : ''}`}>
            <div className="pin-hex pin-hex-blank" aria-hidden="true" />
            <button
              type="button"
              className="pin-swatch pin-swatch-add"
              onClick={onNew}
              aria-label="Add a colour"
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
