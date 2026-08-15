import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Hsl, Pin } from './types'
import { MAX_PINS, THEMES } from './types'
import { hexToHsl } from './color'
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

  const theme = THEMES[settings.theme]
  const themeHsl = useMemo(() => hexToHsl(theme.bg) ?? { h: 0, s: 0, l: 30 }, [theme.bg])

  const [selectedId, setSelectedId] = useState<string | null>(initial.pins[0]?.id ?? null)

  // Undo, redo and delete can all retire the selected pin.
  useEffect(() => {
    if (selectedId !== null && !pins.some((p) => p.id === selectedId)) {
      setSelectedId(pins[0]?.id ?? null)
    }
  }, [pins, selectedId])

  const selected = pins.find((p) => p.id === selectedId) ?? null
  const atCapacity = pins.length >= MAX_PINS

  /** `+` pins the theme colour straight away and hands it to the editor. */
  const handleAdd = useCallback(() => {
    if (atCapacity) return
    const pin: Pin = { id: newId(), hsl: themeHsl }
    commit([...pins, pin])
    setSelectedId(pin.id)
  }, [atCapacity, commit, pins, themeHsl])

  const handleChange = useCallback(
    (next: Hsl) => {
      if (!selected) return
      const id = selected.id
      commit(
        pins.map((p) => (p.id === id ? { ...p, hsl: next } : p)),
        `edit:${id}`,
      )
    },
    [commit, pins, selected],
  )

  const handleDelete = useCallback(
    (id: string) => commit(pins.filter((p) => p.id !== id)),
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
          selectedId={selectedId}
          showAdd={!atCapacity}
          onSelect={setSelectedId}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
        <Editor colour={selected?.hsl ?? null} onChange={handleChange} />
      </main>
    </div>
  )
}
