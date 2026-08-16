import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Pin } from '../types'
import { cssVars, isWide, toHex } from '../color'
import { COPIED_MS, copy } from '../clipboard'
import { announce } from '../announce'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { ClipboardIcon, XIcon } from './icons'

type Props = {
  pins: Pin[]
  selectedId: string
  showAdd: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: () => void
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

export function PinnedPane({
  pins,
  selectedId,
  showAdd,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
}: Props) {
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

  /**
   * The cell runs the width of the stripe on desktop, and almost none of that is
   * the code. A press out in the empty part means the colour, not the clipboard
   * — so the copy is only offered within reach of the characters themselves.
   */
  const HIT_SLOP = 8

  /** Whether the pointer is close enough to the code for the copy to be what is
   *  meant. One predicate, used by the click and by the hover mark together —
   *  the offer and the action have to describe the same region or the cell
   *  lies about what a press will do. */
  const nearCode = (e: { clientX: number; clientY: number }, cell: HTMLElement) => {
    const code = cell.querySelector('.pin-code')?.getBoundingClientRect()
    return (
      !!code &&
      e.clientX >= code.left - HIT_SLOP &&
      e.clientX <= code.right + HIT_SLOP &&
      e.clientY >= code.top - HIT_SLOP &&
      e.clientY <= code.bottom + HIT_SLOP
    )
  }

  const onHexClick = (e: React.MouseEvent<HTMLButtonElement>, pin: Pin) => {
    // A keyboard press has no pointer to test — detail 0 is the tell. The cell
    // is named as the copy and there is no pointer to aim with, so that is what
    // it does; selecting is the swatch's job, and reachable one tab away.
    if (e.detail === 0 || nearCode(e, e.currentTarget)) handleCopy(pin)
    else onSelect(pin.id)
  }

  /** The cell the clipboard is currently offered on. Only ever one, so this is a
   *  single id rather than a flag per pin. */
  const [armed, setArmed] = useState<string | null>(null)

  const onHexMove = (e: React.PointerEvent<HTMLButtonElement>, pin: Pin) => {
    // Touch has no hover to give; it keeps the mark for a focus or a copy, the
    // way it did before there was a hover state to restrict.
    if (e.pointerType !== 'mouse') return
    const near = nearCode(e, e.currentTarget)
    setArmed((was) => (near ? pin.id : was === pin.id ? null : was))
  }

  const handleCopy = useCallback(async (pin: Pin) => {
    const hex = toHex(pin.colour).toUpperCase()
    await copy(hex)
    // Silent, as specified — the cell flashes, and the clipboard mark shows
    // just long enough to be read before it times itself out. The flash is the
    // whole of the feedback, so a screen reader is told in words instead.
    announce(`Copied ${hex}`)
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

  /** A drag ends in a click on the button underneath it. That click is the
   *  tail of the gesture, not a press of its own, and selecting the tile you
   *  just moved is not what was asked for. */
  const dragged = useRef(false)

  const onPointerDown = (e: React.PointerEvent, pin: Pin, index: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    dragged.current = false
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

  /**
   * The reorder, for anyone not holding a pointer.
   *
   * Alt with an arrow, on the axis the pane is laid out along — the same
   * modifier a list reorder takes almost everywhere, and one the browser has no
   * use for on a button. Plain arrows are left alone: they scroll, and taking
   * that away from a keyboard user to move a tile is a poor trade.
   */
  const onSwatchKeyDown = (e: React.KeyboardEvent, pin: Pin, index: number) => {
    if (!e.altKey) return
    const back = e.key === (isDesktop ? 'ArrowUp' : 'ArrowLeft')
    const on = e.key === (isDesktop ? 'ArrowDown' : 'ArrowRight')
    if (!back && !on) return

    const to = index + (back ? -1 : 1)
    if (to < 0 || to >= pins.length) return
    e.preventDefault()
    onReorder(index, to)
    announce(`${toHex(pin.colour).toUpperCase()} moved to position ${to + 1} of ${pins.length}`)
  }

  /**
   * Deleting takes the focused button out of the document with it, which drops
   * focus on the body — a keyboard user loses their place entirely. The colour
   * that takes its place gets it instead.
   */
  const swatchEls = useRef(new Map<string, HTMLButtonElement>())
  const restoreFocus = useRef(false)
  useLayoutEffect(() => {
    if (!restoreFocus.current) return
    restoreFocus.current = false
    swatchEls.current.get(selectedId)?.focus()
  }, [selectedId, pins])

  const onPointerUp = (e: React.PointerEvent, pin: Pin) => {
    const d = endDrag()
    dragged.current = !!d?.moved
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
          const hex = toHex(pin.colour)
          const selected = pin.id === selectedId
          // A colour past sRGB is shown both ways at once: most of the swatch as
          // it really is, and a strip of what a narrower screen will make of it.
          const split = isWide(pin.colour)
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
                }${armed === pin.id ? ' is-armed' : ''}`}
                onClick={(e) => onHexClick(e, pin)}
                onPointerMove={(e) => onHexMove(e, pin)}
                onPointerLeave={() => setArmed((was) => (was === pin.id ? null : was))}
                // Named for what it does rather than for what it reads, and
                // built around the visible code so speech input still reaches
                // it by name.
                aria-label={`Copy ${hex.toUpperCase()}`}
                title="Copy to clipboard"
              >
                <span className="pin-code">{hex.toUpperCase()}</span>
                <ClipboardIcon size={12} />
              </button>
              {/* The gesture surface, and only that: the drag needs an element
                  under the finger, but a control with a control inside it is
                  not a thing a screen reader can describe. The two buttons
                  below sit on it as siblings instead. */}
              <div
                className={`pin-swatch${split ? ' is-split' : ''}`}
                style={cssVars(pin.colour)}
                onPointerDown={(e) => onPointerDown(e, pin, index)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(e, pin)}
                onPointerCancel={endDrag}
              >
                {/* Covers the swatch exactly, so the ring it takes on focus is
                    the swatch's own outline in the same place it always was. */}
                <button
                  type="button"
                  className="pin-select"
                  ref={(el) => {
                    if (el) swatchEls.current.set(pin.id, el)
                    else swatchEls.current.delete(pin.id)
                  }}
                  aria-label={`Edit colour ${hex}${split ? ', outside sRGB' : ''}`}
                  aria-pressed={selected}
                  aria-keyshortcuts={isDesktop ? 'Alt+ArrowUp Alt+ArrowDown' : 'Alt+ArrowLeft Alt+ArrowRight'}
                  onClick={() => {
                    if (dragged.current) {
                      dragged.current = false
                      return
                    }
                    onSelect(pin.id)
                  }}
                  onKeyDown={(e) => onSwatchKeyDown(e, pin, index)}
                />
                {/* Only on the colour being edited, and inside the swatch rather
                    than beside the picker: it acts on this colour, so it belongs
                    on it. */}
                {split && (
                  <span className="pin-split" aria-hidden="true">
                    P3 • sRGB
                  </span>
                )}
                {selected && (
                  <button
                    type="button"
                    className="pin-remove"
                    // The swatch owns the drag gesture; this must not start one.
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      restoreFocus.current = true
                      onDelete()
                      announce(`Removed ${hex.toUpperCase()}`)
                    }}
                    aria-label={`Remove colour ${hex}`}
                    title="Remove colour"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>
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
