import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Pin } from '../types'
import { hslToCss, hslToHex } from '../color'
import { COPIED_MS, copy } from '../clipboard'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { ClipboardIcon } from './icons'

type Props = {
  pins: Pin[]
  selectedId: string
  showAdd: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  onReorder: (from: number, to: number) => void
}

const DRAG_THRESHOLD = 8
const SLIDE_MS = 180

type Drag = {
  id: string
  index: number
  /** Pointer position at the grab, and the tile's layout position then. */
  x: number
  y: number
  home: number
  moved: boolean
}

export function PinnedPane({ pins, selectedId, showAdd, onSelect, onAdd, onReorder }: Props) {
  const isDesktop = useIsDesktop()
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const drag = useRef<Drag | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const flashTimer = useRef<number | null>(null)

  // Tiles are laid out by flex, so a reorder moves them instantly. These carry
  // the FLIP animation that puts the movement back: the elements, and where
  // each one sat along the pane's axis at the last render.
  const pinEls = useRef(new Map<string, HTMLDivElement>())
  const homes = useRef(new Map<string, number>())

  /** Layout position along the pane's axis. Read from the offset box rather
   *  than a client rect, so an in-flight transform doesn't taint it. */
  const axisPos = useCallback(
    (el: HTMLElement) => (isDesktop ? el.offsetTop : el.offsetLeft),
    [isDesktop],
  )

  const translate = useCallback(
    (px: number) => (isDesktop ? `translateY(${px}px)` : `translateX(${px}px)`),
    [isDesktop],
  )

  /** The dragged tile follows the finger, offset from wherever it now lives. */
  const applyDragTransform = useCallback(() => {
    const d = drag.current
    if (!d?.moved) return
    const el = pinEls.current.get(d.id)
    if (!el) return
    const delta = isDesktop ? pointer.current.y - d.y : pointer.current.x - d.x
    el.style.transition = 'none'
    el.style.transform = translate(delta - (axisPos(el) - d.home))
  }, [axisPos, isDesktop, translate])

  const settle = useCallback((el: HTMLElement) => {
    el.style.transition = `transform ${SLIDE_MS}ms ease`
    el.style.transform = ''
  }, [])

  // After every render during a drag, the tiles that swapped places start from
  // where they were and slide to where they now are. Only during a drag: a
  // resize or an added colour should just lay out, not animate.
  useLayoutEffect(() => {
    const dragging = drag.current?.moved ? drag.current.id : null
    const next = new Map<string, number>()

    for (const pin of pins) {
      const el = pinEls.current.get(pin.id)
      if (!el) continue
      const now = axisPos(el)
      const prev = homes.current.get(pin.id)
      next.set(pin.id, now)

      if (pin.id === dragging || !dragging) continue
      if (prev === undefined || Math.abs(prev - now) < 1) continue

      el.style.transition = 'none'
      el.style.transform = translate(prev - now)
      void el.offsetWidth // flush, so the slide has somewhere to start from
      settle(el)
    }

    homes.current = next
    applyDragTransform()
  })

  const handleCopy = useCallback(async (pin: Pin) => {
    await copy(hslToHex(pin.hsl))
    // Silent, as specified — the cell flashes, and the clipboard mark shows
    // just long enough to be read before it times itself out.
    setCopied(pin.id)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setCopied(null), COPIED_MS)
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

  /** Lets go, sliding the tile from under the finger into its slot. */
  const endDrag = useCallback(() => {
    const d = drag.current
    drag.current = null
    setDraggingId(null)
    if (!d) return
    const el = pinEls.current.get(d.id)
    if (el && d.moved) settle(el)
    return d
  }, [settle])

  const onPointerDown = (e: React.PointerEvent, pin: Pin, index: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const el = pinEls.current.get(pin.id)
    drag.current = {
      id: pin.id,
      index,
      x: e.clientX,
      y: e.clientY,
      home: el ? axisPos(el) : 0,
      moved: false,
    }
    pointer.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    pointer.current = { x: e.clientX, y: e.clientY }

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
      // The re-render's layout effect slides the others and re-anchors this
      // one; a plain move only has to move this one.
      return
    }
    applyDragTransform()
  }

  const onPointerUp = (e: React.PointerEvent, pin: Pin) => {
    const d = endDrag()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    // A press that never became a drag is a plain selection.
    if (d && !d.moved) onSelect(pin.id)
  }

  return (
    <section className="pins" aria-label="Pinned colours">
      <div className="pins-track" ref={containerRef}>
        {pins.map((pin, index) => {
          const hex = hslToHex(pin.hsl)
          const selected = pin.id === selectedId
          return (
            <div
              key={pin.id}
              className={`pin${draggingId === pin.id ? ' is-dragging' : ''}`}
              ref={(el) => {
                if (el) pinEls.current.set(pin.id, el)
                else pinEls.current.delete(pin.id)
              }}
            >
              {/* Selection reads as an inverted hex cell, not an outline. */}
              <button
                type="button"
                className={`pin-hex${selected ? ' is-selected' : ''}${
                  copied === pin.id ? ' is-copied' : ''
                }`}
                onClick={() => handleCopy(pin)}
                title="Copy to clipboard"
              >
                {hex.toUpperCase()}
                <ClipboardIcon size={11} />
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
                onPointerCancel={endDrag}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(pin.id)
                  }
                }}
              />
            </div>
          )
        })}

        {/* The add column has no hex cell of its own — the button runs the full
            height of the pane, through the space the hex bar occupies on the
            other columns. */}
        {showAdd && (
          <div className="pin pin-add">
            <button
              type="button"
              className="pin-swatch pin-swatch-add"
              onClick={onAdd}
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
