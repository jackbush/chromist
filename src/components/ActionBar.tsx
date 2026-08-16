import { useCallback, useRef, useState } from 'react'
import type { Colour, Pin, Settings } from '../types'
import type { Vision } from '../cvd'
import { OTHER_THEME } from '../types'
import { buildShareUrl } from '../urlHash'
import { site } from '../../site.config'
import { COPIED_MS, copy } from '../clipboard'
import { announce } from '../announce'
import { EditColoursDialog } from './EditColoursDialog'
import {
  ContrastIcon,
  MoonIcon,
  PencilIcon,
  QuestionIcon,
  RedoIcon,
  LinkIcon,
  SunIcon,
  TrashIcon,
  UndoIcon,
} from './icons'

/** The readme is the manual: what each colour space is for, what the audit's
 *  two specifications disagree about, and why the app is built the way it is. */
const HELP_URL = 'https://github.com/jackbush/chromist#readme'

type Props = {
  pins: Pin[]
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  onEditList: (colours: Colour[]) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
  auditing: boolean
  vision: Vision
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
  vision,
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
    await copy(
      buildShareUrl(pins, {
        audit: auditing,
        vision,
        spec: settings.spec,
        weight: settings.weight,
        gamut: settings.gamut,
      }),
    )
    // The button flashes and nothing else happens; said in words, it is the
    // difference between a copy that worked and a button that did nothing.
    announce(auditing ? 'Link to this audit copied' : 'Link to this palette copied')
    setCopied(true)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
  }, [auditing, pins, settings.gamut, settings.spec, settings.weight, vision])

  return (
    <header className="bar">
      <h1 className="bar-title">{site.name}</h1>

      {/* Read left to right: the three ways of working on the palette, then
          reset, then the pair for taking an edit back and the theme switch.
          The first four carry their names where there is room for them; the
          last three are common enough to go without. */}
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
          <span className="bar-label">Edit</span>
        </button>
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
          <span className="bar-label">Audit</span>
        </button>
        {/* You share the screen you are on, so the label says which. */}
        <button
          type="button"
          className={`bar-btn${copied ? ' is-copied' : ''}`}
          onClick={handleCopyLink}
          aria-label={auditing ? 'Copy a link to this audit' : 'Copy a link to this palette'}
          title={auditing ? 'Copy a link to this audit' : 'Copy a link to this palette'}
        >
          <LinkIcon />
          <span className="bar-label">Copy link</span>
        </button>
        <button
          type="button"
          className="bar-btn"
          onClick={onReset}
          aria-label="Reset everything"
          title="Reset everything"
        >
          <TrashIcon />
          <span className="bar-label">Reset</span>
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
        {/* An anchor, not a button: it goes somewhere, so a middle-click or a
            modifier should open it the way any other link would. */}
        <a
          className="bar-btn"
          href={HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          // Where it goes, and that it leaves: an unannounced new tab strands
          // anyone who navigates back by keyboard or by gesture.
          aria-label="Help — the readme, opens in a new tab"
          title="Help"
        >
          <QuestionIcon />
        </a>
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
