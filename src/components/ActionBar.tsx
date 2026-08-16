import { useCallback, useEffect, useRef, useState } from 'react'
import type { Pin, Settings } from '../types'
import { buildShareUrl } from '../urlHash'
import { COPIED_MS, copy } from '../clipboard'
import { SettingsPopover } from './SettingsPopover'
import { EditColoursDialog } from './EditColoursDialog'
import {
  ClipboardIcon,
  PencilIcon,
  RedoIcon,
  ResetIcon,
  SettingsIcon,
  ShareIcon,
  UndoIcon,
} from './icons'

type Props = {
  pins: Pin[]
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onEditList: (hexes: string[]) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
}

export function ActionBar({
  pins,
  settings,
  onSettingsChange,
  onEditList,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
}: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const flashTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleCopyLink = useCallback(async () => {
    await copy(buildShareUrl(pins))
    setCopied(true)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }, [pins])

  return (
    <header className="bar">
      <h1 className="bar-title">
        <button
          type="button"
          className={`bar-share${copied ? ' is-copied' : ''}`}
          onClick={handleCopyLink}
          title="Copy a link to this palette"
        >
          <ShareIcon size={14} />
          Share this palette
          <ClipboardIcon size={14} className="clip" />
        </button>
      </h1>

      <div className="bar-actions">
        <button
          type="button"
          className="bar-btn"
          onClick={() => setEditing(true)}
          aria-haspopup="dialog"
          aria-label="Edit colours"
          title="Edit colours"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className="bar-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="bar-btn"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          <RedoIcon />
        </button>
        <div className="bar-settings" ref={wrapRef}>
          <button
            type="button"
            className="bar-btn"
            aria-label="Settings"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((v) => !v)}
          >
            <SettingsIcon />
          </button>
          {open && <SettingsPopover settings={settings} onChange={onSettingsChange} />}
        </div>

        <button
          type="button"
          className="bar-btn"
          onClick={onReset}
          aria-label="Reset everything"
          title="Reset everything"
        >
          <ResetIcon />
        </button>
      </div>

      {editing && (
        <EditColoursDialog pins={pins} onApply={onEditList} onClose={() => setEditing(false)} />
      )}
    </header>
  )
}
