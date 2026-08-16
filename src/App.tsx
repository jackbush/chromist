import { useCallback, useEffect, useRef, useState } from 'react'
import type { Colour, Gamut, ModeId, Pin, Spec, Weight } from './types'
import { MAX_PINS } from './types'
import { distinctFrom, oppositeColour, randomColour, toGamut } from './color'
import { clampCount, gamutFor, modeById } from './modes'
import { newId } from './id'
import { clear as clearStorage, DEFAULT_SETTINGS } from './storage'
import { useInitialState, usePersist } from './hooks/usePersistentState'
import { useHistory } from './hooks/useHistory'
import { useThemeColor } from './hooks/useThemeColor'
import { PinnedPane } from './components/PinnedPane'
import { Editor } from './components/Editor'
import { ActionBar } from './components/ActionBar'
import { ContrastAudit } from './components/ContrastAudit'
import type { Vision } from './cvd'

export function App() {
  const initial = useInitialState()

  const {
    present: pins,
    commit,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<Pin[]>(initial.pins)
  const [settings, setSettings] = useState(initial.settings)

  // The audit is a second way of looking at the same palette rather than a
  // window over it: the bar keeps working, and every edit made from it lands on
  // the grid straight away.
  const [auditing, setAuditing] = useState(initial.audit)
  // Which eye the audit is read through. Like the audit itself this describes a
  // look at the palette rather than the palette, so it rides in the URL and
  // stays out of storage.
  const [vision, setVision] = useState<Vision>(initial.vision)
  usePersist(pins, settings, auditing, vision)
  // The phone's own bars wear the app's theme, not the system's.
  useThemeColor(settings.theme)

  const [selectedId, setSelectedId] = useState<string>(initial.pins[0].id)

  // Undo, redo and delete can all retire the selected pin. The palette is
  // never empty, so there is always something to fall back to.
  useEffect(() => {
    if (!pins.some((p) => p.id === selectedId)) setSelectedId(pins[0].id)
  }, [pins, selectedId])

  const selected = pins.find((p) => p.id === selectedId) ?? pins[0]
  const atCapacity = pins.length >= MAX_PINS

  /** `+` pins the opposite of whatever is selected and hands it to the editor —
   *  unless that colour is already in the palette, in which case it starts over
   *  on a random one. It lands next to the colour it came from rather than at
   *  the end, so a pair stays a pair without a reorder. */
  const handleAdd = useCallback(() => {
    if (atCapacity) return
    const colour = distinctFrom(
      oppositeColour(selected.colour),
      pins.map((p) => p.colour),
      // A new colour is reachable in whatever space is being edited in.
      gamutFor(modeById(settings.mode)),
    )
    const pin: Pin = { id: newId(), colour }
    const after = pins.findIndex((p) => p.id === selected.id) + 1
    commit([...pins.slice(0, after), pin, ...pins.slice(after)])
    setSelectedId(pin.id)
  }, [atCapacity, commit, pins, selected, settings.mode])

  const handleChange = useCallback(
    (next: Colour) => {
      const id = selected.id
      commit(
        pins.map((p) => (p.id === id ? { ...p, colour: next } : p)),
        `edit:${id}`,
      )
    },
    [commit, pins, selected],
  )

  /** Removing the last colour starts over rather than leaving the app with
   *  nothing to edit. With no selection left there is no opposite to take, so
   *  it lands on a random colour — the same state a first-time user gets. */
  const handleDeleteSelected = useCallback(() => {
    const index = pins.findIndex((p) => p.id === selected.id)
    const remaining = pins.filter((p) => p.id !== selected.id)
    if (remaining.length > 0) {
      commit(remaining)
      // Stay in the same position rather than jumping to the front: whatever
      // slid into the gap, or the new last colour if the end one went.
      setSelectedId(remaining[Math.min(index, remaining.length - 1)].id)
      return
    }
    const fresh: Pin = { id: newId(), colour: randomColour() }
    commit([fresh])
    setSelectedId(fresh.id)
  }, [commit, pins, selected])

  /**
   * The colour space is the palette's, not the selected colour's, so changing it
   * has to answer for all of them. Only ever lossy one way — every sRGB colour
   * has an OKLCH reading — so this asks on the way in, and only when there is
   * something to lose. Answering yes performs the clamp the warning describes
   * rather than leaving colours in a space that cannot name them, as one commit
   * so a single undo takes it back.
   */
  const handleModeChange = useCallback(
    (mode: ModeId) => {
      const next = modeById(mode)
      const affected = clampCount(
        next,
        pins.map((p) => p.colour),
      )
      if (affected > 0) {
        const many = affected > 1
        const ok = window.confirm(
          `Switch to ${next.label}?\n\n` +
            `${affected} ${many ? 'colours are' : 'colour is'} outside sRGB, which ` +
            `${next.label} can't describe. ${many ? 'Each will' : 'It will'} be replaced by ` +
            `the nearest colour that fits.`,
        )
        if (!ok) return
        commit(pins.map((p) => ({ ...p, colour: toGamut(p.colour, 'srgb') })))
      }
      setSettings((s) => ({ ...s, mode }))
    },
    [commit, pins],
  )

  /** The whole palette, rewritten from the text list in one step. Ids are kept
   *  by position so the selection survives an edit that leaves it in place. */
  const handleEditList = useCallback(
    (colours: Colour[]) => {
      const next = colours.map((colour, i) => ({ id: pins[i]?.id ?? newId(), colour }))
      if (next.length > 0) commit(next)
    },
    [commit, pins],
  )

  const handleReorder = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= pins.length || to >= pins.length) return
      const next = [...pins]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      // One tag for the whole drag, so a reorder is a single undo step.
      commit(next, `reorder:${moved.id}`)
    },
    [commit, pins],
  )

  /** Wipes the palette, the settings and the stored copy of both. Destructive
   *  and not undoable, so it asks first. */
  const handleReset = useCallback(() => {
    const ok = window.confirm(
      'Reset everything?\n\nThis clears your palette and settings. It cannot be undone.',
    )
    if (!ok) return

    clearStorage()
    const fresh: Pin = { id: newId(), colour: randomColour() }
    reset([fresh])
    setSelectedId(fresh.id)
    setSettings(DEFAULT_SETTINGS)
  }, [reset])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.key.toLowerCase() !== 'z') return
      // Let the field's own undo work while typing a hex code or a list.
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLInputElement && e.target.type === 'text') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [redo, undo])

  /**
   * The bar comes first in the DOM and holds eight controls, so reaching the
   * palette by keyboard means going through all of them — and on a phone the
   * bar is at the *bottom* of the screen, so the tab order starts at the far
   * end of the layout. This jumps over it.
   *
   * A button rather than the usual `href="#main"`: the address bar is the
   * share link here, and a fragment would overwrite the palette in it.
   */
  const mainRef = useRef<HTMLElement>(null)

  return (
    <div className="app" data-theme={settings.theme}>
      <button
        type="button"
        className="skip-link"
        onClick={() => mainRef.current?.focus()}
      >
        Skip to the palette
      </button>
      <ActionBar
        pins={pins}
        settings={settings}
        onSettingsChange={setSettings}
        onEditList={handleEditList}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onReset={handleReset}
        auditing={auditing}
        vision={vision}
        onToggleAudit={() => setAuditing((on) => !on)}
      />
      {auditing ? (
        <ContrastAudit
          ref={mainRef}
          pins={pins}
          vision={vision}
          spec={settings.spec}
          weight={settings.weight}
          gamut={settings.gamut}
          onVisionChange={setVision}
          onSpecChange={(spec: Spec) => setSettings({ ...settings, spec })}
          onWeightChange={(weight: Weight) => setSettings({ ...settings, weight })}
          onGamutChange={(gamut: Gamut) => setSettings({ ...settings, gamut })}
          onExit={() => setAuditing(false)}
        />
      ) : (
        <main className="panes" ref={mainRef} tabIndex={-1}>
          <PinnedPane
            pins={pins}
            selectedId={selected.id}
            showAdd={!atCapacity}
            onSelect={setSelectedId}
            onAdd={handleAdd}
            onDelete={handleDeleteSelected}
            onReorder={handleReorder}
          />
          <Editor
            colour={selected.colour}
            mode={settings.mode}
            onChange={handleChange}
            onModeChange={handleModeChange}
          />
        </main>
      )}
    </div>
  )
}
