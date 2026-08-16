import { useEffect, useId, useRef, type ReactNode, type CSSProperties } from 'react'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

export type ModalAction = {
  label: string
  onClick: () => void
  disabled?: boolean
}

type Props = {
  /** Sentence case, and a question where it is one. */
  title: string
  /** The smaller second line: what the title leaves out. */
  description?: ReactNode
  /** Fields, a list, a message — whatever sits between the heading and the
   *  buttons. An alert with nothing to add leaves it out. */
  children?: ReactNode
  /** The one thing the dialog is for, drawn inverted. */
  primary: ModalAction
  /** The way back out, where it is worth naming. */
  secondary?: ModalAction
  /**
   * `form` holds fields, and takes the whole of a small screen: a keyboard over
   * a floating card leaves nothing of the card. `alert` only has something to
   * say, so it stays a card at every size.
   */
  variant?: 'form' | 'alert'
  onClose: () => void
}

/**
 * Every dialog in the app, and every question it asks.
 *
 * There is one of these because there was nearly one of each: a full-screen
 * editor, a settings sheet, and two `window.confirm`s that arrived in the
 * system font, in the browser's own words, with no theme and no way to say what
 * the buttons meant. Everything that makes a dialog a dialog lives here — the
 * top layer, the inert page behind it, escape, the focus that comes back — so
 * the next one inherits all of it rather than half.
 */
export function Modal({
  title,
  description,
  children,
  primary,
  secondary,
  variant = 'form',
  onClose,
}: Props) {
  const keyboardInset = useKeyboardInset()
  const titleId = useId()
  const noteId = useId()

  /**
   * `showModal` puts the dialog in the top layer and makes everything behind it
   * inert — to the pointer, to Tab, and to a screen reader's cursor. A focus
   * trap in JavaScript only ever managed the middle one of those.
   */
  const backdropRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = backdropRef.current
    if (!el?.isConnected || el.open) return
    el.showModal()
    return () => el.close()
  }, [])

  /** Whatever opened the dialog gets the focus back when it closes — the
   *  keyboard should end up where it started, not at the top of the page.
   *  Read during the first render, before anything inside takes the focus. */
  const opener = useRef(document.activeElement)
  useEffect(
    () => () => {
      const el = opener.current
      if (el instanceof HTMLElement && el.isConnected) el.focus()
    },
    [],
  )

  /** Escape reaches the element itself. Answering `cancel` rather than the
   *  keystroke keeps one closing path: the element would otherwise take itself
   *  out of the top layer while React still believed it was open. */
  const onCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault()
    onClose()
  }

  return (
    <dialog
      className="dialog-backdrop"
      ref={backdropRef}
      aria-labelledby={titleId}
      aria-describedby={description ? noteId : undefined}
      onCancel={onCancel}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* The <dialog> above is the dialog as far as a screen reader is concerned
          — it is named there, and showModal makes it modal. This is only the
          card the contents are laid out on. */}
      <div
        className={`dialog is-${variant}`}
        style={{ '--keyboard-inset': `${keyboardInset}px` } as CSSProperties}
      >
        {/* Everything above the buttons scrolls, so a card with more in it than
            the screen has room for — a phone with the keyboard up — gives way
            here rather than pushing the buttons off the bottom. */}
        <div className="dialog-body">
          <div>
            <h2 className="dialog-title" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="dialog-note" id={noteId}>
                {description}
              </p>
            )}
          </div>
          {children}
        </div>

        {/* The way out on the left, the thing you came for on the right. */}
        <div className="dialog-actions">
          {secondary && (
            <button
              type="button"
              className="dialog-btn is-secondary"
              onClick={secondary.onClick}
              disabled={secondary.disabled}
            >
              {secondary.label}
            </button>
          )}
          <button
            type="button"
            className="dialog-btn is-primary"
            onClick={primary.onClick}
            disabled={primary.disabled}
          >
            {primary.label}
          </button>
        </div>
      </div>
    </dialog>
  )
}
