import { useCallback, useRef, useState } from 'react'
import type { Pin, Settings } from '../types'
import { OTHER_THEME } from '../types'
import { buildShareUrl } from '../urlHash'
import { COPIED_MS, copy } from '../clipboard'
import { EditColoursDialog } from './EditColoursDialog'
import {
  ClipboardIcon,
  MoonIcon,
  PencilIcon,
  RedoIcon,
  ResetIcon,
  ShareIcon,
  SunIcon,
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
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const flashTimer = useRef<number | null>(null)

  // The icon is the destination, not the current state: on black you see the
  // sun you're about to switch to.
  const dark = settings.theme === 'black'

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
        <button
          type="button"
          className="bar-btn"
          onClick={() => onSettingsChange({ ...settings, theme: OTHER_THEME[settings.theme] })}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>

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
