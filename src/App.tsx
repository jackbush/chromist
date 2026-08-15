import { useCallback, useEffect, useState } from 'react'
import type { Hsl, Pin } from './types'
import { MAX_PINS } from './types'
import { oppositeHsl, randomHsl } from './color'
import { newId } from './id'
import { useInitialState, usePersist } from './hooks/usePersistentState'
import { useHistory } from './hooks/useHistory'
import { PinnedPane } from './components/PinnedPane'
import { Editor } from './components/Editor'
import { ActionBar } from './components/ActionBar'

export function App() {
  const initial = useInitialState()

  const { present: pins, commit, undo, redo, canUndo, canRedo } = useHistory<Pin[]>(initial.pins)
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

  /** `+` pins the opposite of whatever is selected and hands it to the editor. */
  const handleAdd = useCallback(() => {
    if (atCapacity) return
    const pin: Pin = { id: newId(), hsl: oppositeHsl(selected.hsl) }
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
    const remaining = pins.filter((p) => p.id !== selected.id)
    if (remaining.length > 0) {
      commit(remaining)
      return
    }
    const fresh: Pin = { id: newId(), hsl: randomHsl() }
    commit([fresh])
    setSelectedId(fresh.id)
  }, [commit, pins, selected])

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.key.toLowerCase() !== 'z') return
      // Let the field's own undo work while typing a hex code.
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
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
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
