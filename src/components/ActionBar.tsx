import { useCallback, useRef, useState } from 'react'
import type { Pin, Settings } from '../types'
import { OTHER_THEME } from '../types'
import { buildShareUrl } from '../urlHash'
import { COPIED_MS, copy } from '../clipboard'
import { EditColoursDialog } from './EditColoursDialog'
import {
  ClipboardIcon,
  ContrastIcon,
  MoonIcon,
  PencilIcon,
  RedoIcon,
  ShareIcon,
  SunIcon,
  TrashIcon,
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
  auditing: boolean
  onToggleAudit: () => void
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
  auditing,
  onToggleAudit,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const flashTimer = useRef<number | null>(null)

  // The icon is the destination, not the current state: on black you see the
  // sun you're about to switch to.
  const dark = settings.theme === 'black'

  // You share the screen you're on, so a link copied from the audit opens on
  // the audit — same palette, same reading of it.
  const handleCopyLink = useCallback(async () => {
    await copy(buildShareUrl(pins, auditing))
    setCopied(true)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }, [auditing, pins])

  const shareLabel = auditing ? 'Share this audit' : 'Share this palette'

  return (
    <header className="bar">
      <h1 className="bar-title">
        <button
          type="button"
          className={`bar-share${copied ? ' is-copied' : ''}`}
          onClick={handleCopyLink}
          title={auditing ? 'Copy a link to this audit' : 'Copy a link to this palette'}
        >
          <ShareIcon size={14} />
          {shareLabel}
          <ClipboardIcon size={14} className="clip" />
        </button>
      </h1>

      {/* Read left to right: the two ways of looking at the palette, then the
          two ways of taking an edit back, then the two that change the app
          rather than the colours — the most destructive one furthest from the
          ones you press without thinking. */}
      <div className="bar-actions">
        {/* A mode, not a window: the button stays lit for as long as you're in
            it, and pressing it again is the way out. */}
        <button
          type="button"
          className={`bar-btn${auditing ? ' is-active' : ''}`}
          onClick={onToggleAudit}
          aria-pressed={auditing}
          aria-label="Accessibility audit"
          title={auditing ? 'Leave the accessibility audit' : 'Accessibility audit'}
        >
          <ContrastIcon />
        </button>
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
        <button
          type="button"
          className="bar-btn"
          onClick={onReset}
          aria-label="Reset everything"
          title="Reset everything"
        >
          <TrashIcon />
        </button>
        <button
          type="button"
          className="bar-btn"
          onClick={() => onSettingsChange({ ...settings, theme: OTHER_THEME[settings.theme] })}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {editing && (
        <EditColoursDialog pins={pins} onApply={onEditList} onClose={() => setEditing(false)} />
      )}
    </header>
  )
}
