import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

type Props = {
  title: string
  /** Names the dialog, and is what the heading carries. */
  titleId: string
  /** The line under the heading, where a dialog needs one. */
  note?: ReactNode
  noteId?: string
  children: ReactNode
  /** The buttons along the foot. */
  actions: ReactNode
  onClose: () => void
}

/**
 * The app's one dialog, for both of the things that need one.
 *
 * On a phone it is the screen: whatever it holds is the whole task, and a
 * floating card would only hand the keyboard something to cover. Everything
 * that makes it a dialog rather than a div lives here — the top layer, the
 * inert page behind it, escape, the focus that comes back — so a second dialog
 * inherits all of it instead of reimplementing a half of it.
 */
export function Modal({ title, titleId, note, noteId, children, actions, onClose }: Props) {
  const keyboardInset = useKeyboardInset()

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
      onCancel={onCancel}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* The <dialog> above is the dialog as far as a screen reader is concerned
          — it is named there, and showModal makes it modal. This is only the
          card the contents are laid out on. */}
      <div
        className="dialog"
        style={{ '--keyboard-inset': `${keyboardInset}px` } as CSSProperties}
      >
        {/* Everything above the buttons scrolls, so a short screen — a phone
            with the keyboard up — takes it out of the contents rather than off
            the bottom of the dialog. */}
        <div className="dialog-body">
          <div>
            <h2 className="dialog-title" id={titleId}>
              {title}
            </h2>
            {note && (
              <p className="dialog-note" id={noteId}>
                {note}
              </p>
            )}
          </div>
          {children}
        </div>

        <div className="dialog-actions">{actions}</div>
      </div>
    </dialog>
  )
}
