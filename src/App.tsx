import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Hsl, Pin, Selection } from './types'
import { MAX_PINS, THEMES } from './types'
import { hexToHsl, hslEquals } from './color'
import { newId } from './id'
import { usePersistentState } from './hooks/usePersistentState'
import { PinnedPane } from './components/PinnedPane'
import { Editor } from './components/Editor'
import { ActionBar } from './components/ActionBar'

export function App() {
  const { pins, setPins, settings, setSettings } = usePersistentState()
  const theme = THEMES[settings.theme]

  const themeHsl = useMemo(() => hexToHsl(theme.bg) ?? { h: 0, s: 0, l: 30 }, [theme.bg])

  const [selection, setSelection] = useState<Selection>({ mode: 'new' })
  const [draft, setDraft] = useState<Hsl>(themeHsl)
  /** Snapshot of a pin as it was when selected, so REVERT has something to go back to. */
  const [baseline, setBaseline] = useState<Hsl | null>(null)
  /** An untouched draft follows the theme; once edited it is the user's colour. */
  const draftPristine = useRef(true)

  useEffect(() => {
    if (selection.mode === 'new' && draftPristine.current) setDraft(themeHsl)
  }, [themeHsl, selection.mode])

  const selectedPin =
    selection.mode === 'pin' ? (pins.find((p) => p.id === selection.id) ?? null) : null

  // A pin can vanish (deleted, or replaced by a shared palette) while selected.
  useEffect(() => {
    if (selection.mode === 'pin' && !pins.some((p) => p.id === selection.id)) {
      setSelection({ mode: 'new' })
      draftPristine.current = true
      setDraft(themeHsl)
      setBaseline(null)
    }
  }, [pins, selection, themeHsl])

  const colour = selectedPin ? selectedPin.hsl : draft
  const isDirty = Boolean(selectedPin && baseline && !hslEquals(selectedPin.hsl, baseline))
  const atCapacity = pins.length >= MAX_PINS

  const handleChange = useCallback(
    (next: Hsl) => {
      if (selection.mode === 'pin') {
        const id = selection.id
        setPins((prev) => prev.map((p) => (p.id === id ? { ...p, hsl: next } : p)))
      } else {
        draftPristine.current = false
        setDraft(next)
      }
    },
    [selection, setPins],
  )

  const handleSelectPin = useCallback(
    (id: string) => {
      const pin = pins.find((p) => p.id === id)
      if (!pin) return
      setSelection({ mode: 'pin', id })
      setBaseline(pin.hsl)
    },
    [pins],
  )

  const handleNew = useCallback(() => {
    setSelection({ mode: 'new' })
    setBaseline(null)
    draftPristine.current = true
    setDraft(themeHsl)
  }, [themeHsl])

  const handlePin = useCallback(() => {
    if (atCapacity) return
    const pin: Pin = { id: newId(), hsl: draft }
    setPins((prev) => [...prev, pin])
    setSelection({ mode: 'pin', id: pin.id })
    setBaseline(draft)
  }, [atCapacity, draft, setPins])

  const handleRevert = useCallback(() => {
    if (!selectedPin || !baseline) return
    const id = selectedPin.id
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, hsl: baseline } : p)))
  }, [baseline, selectedPin, setPins])

  const handleDelete = useCallback(
    (id: string) => setPins((prev) => prev.filter((p) => p.id !== id)),
    [setPins],
  )

  const handleReorder = useCallback(
    (from: number, to: number) => {
      setPins((prev) => {
        if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
          return prev
        }
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      })
    },
    [setPins],
  )

  return (
    <div className="app" data-theme={settings.theme}>
      <ActionBar pins={pins} settings={settings} onSettingsChange={setSettings} />
      <main className="panes">
        <PinnedPane
          pins={pins}
          selectedId={selectedPin?.id ?? null}
          showAdd={!atCapacity}
          isAdding={selection.mode === 'new'}
          onSelect={handleSelectPin}
          onNew={handleNew}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
        <Editor
          colour={colour}
          picker={settings.picker}
          mode={selection.mode}
          isDirty={isDirty}
          atCapacity={atCapacity}
          onChange={handleChange}
          onPin={handlePin}
          onRevert={handleRevert}
        />
      </main>
    </div>
  )
}
