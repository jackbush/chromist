import { useCallback, useEffect, useState } from 'react'
import type { Hsl, Pin } from './types'
import { MAX_PINS } from './types'
import { distinctFrom, hexToHsl, oppositeHsl, randomHsl } from './color'
import { newId } from './id'
import { clear as clearStorage, DEFAULT_SETTINGS } from './storage'
import { useInitialState, usePersist } from './hooks/usePersistentState'
import { useHistory } from './hooks/useHistory'
import { PinnedPane } from './components/PinnedPane'
import { Editor } from './components/Editor'
import { ActionBar } from './components/ActionBar'

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
  usePersist(pins, settings)

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
   *  on a random one. */
  const handleAdd = useCallback(() => {
    if (atCapacity) return
    const hsl = distinctFrom(
      oppositeHsl(selected.hsl),
      pins.map((p) => p.hsl),
    )
    const pin: Pin = { id: newId(), hsl }
    commit([...pins, pin])
    setSelectedId(pin.id)
  }, [atCapacity, commit, pins, selected])

  const handleChange = useCallback(
    (next: Hsl) => {
      const id = selected.id
      commit(
        pins.map((p) => (p.id === id ? { ...p, hsl: next } : p)),
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
    const fresh: Pin = { id: newId(), hsl: randomHsl() }
    commit([fresh])
    setSelectedId(fresh.id)
  }, [commit, pins, selected])

  /** The whole palette, rewritten from the text list in one step. Ids are kept
   *  by position so the selection survives an edit that leaves it in place. */
  const handleEditList = useCallback(
    (hexes: string[]) => {
      const next: Pin[] = []
      hexes.forEach((hex, i) => {
        const hsl = hexToHsl(hex)
        if (hsl) next.push({ id: pins[i]?.id ?? newId(), hsl })
      })
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
    const fresh: Pin = { id: newId(), hsl: randomHsl() }
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

  return (
    <div className="app" data-theme={settings.theme}>
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
      />
      <main className="panes">
        <PinnedPane
          pins={pins}
          selectedId={selected.id}
          showAdd={!atCapacity}
          onSelect={setSelectedId}
          onAdd={handleAdd}
          onReorder={handleReorder}
        />
        <Editor colour={selected.hsl} onChange={handleChange} onDelete={handleDeleteSelected} />
      </main>
    </div>
  )
}
