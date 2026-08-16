import { useCallback, useReducer, useRef } from 'react'

/** Continuous edits (dragging in the picker, dragging to reorder) collapse into
 *  one history entry while they keep arriving inside this window. */
const COALESCE_MS = 400
const LIMIT = 100

type State<T> = { past: T[]; present: T; future: T[] }

type Action<T> =
  | { type: 'commit'; next: T; coalesce: boolean }
  | { type: 'reset'; next: T }
  | { type: 'undo' }
  | { type: 'redo' }

/** Exported for the assertions in `checks/logic.ts`. */
export function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  const { past, present, future } = state

  switch (action.type) {
    case 'commit':
      // A coalesced commit overwrites the present without deepening history.
      if (action.coalesce) return { past, present: action.next, future: [] }
      return { past: [...past, present].slice(-LIMIT), present: action.next, future: [] }

    // A reset is a fresh start, so there is nothing left to step back into.
    case 'reset':
      return { past: [], present: action.next, future: [] }

    case 'undo': {
      if (past.length === 0) return state
      return {
        past: past.slice(0, -1),
        present: past[past.length - 1],
        future: [present, ...future],
      }
    }

    case 'redo': {
      if (future.length === 0) return state
      return { past: [...past, present], present: future[0], future: future.slice(1) }
    }
  }
}

/**
 * Undoable state. `commit` takes an optional tag: successive commits sharing a
 * tag within COALESCE_MS collapse together, so one slider drag is one undo step
 * rather than one per pointer event.
 */
export function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [] })

  const lastTag = useRef<string | null>(null)
  const lastAt = useRef(0)

  const commit = useCallback((next: T, tag?: string) => {
    const now = Date.now()
    const coalesce = tag != null && tag === lastTag.current && now - lastAt.current < COALESCE_MS
    lastTag.current = tag ?? null
    lastAt.current = now
    dispatch({ type: 'commit', next, coalesce })
  }, [])

  const reset = useCallback((next: T) => {
    lastTag.current = null
    dispatch({ type: 'reset', next })
  }, [])

  // Undo/redo must not be swallowed by a still-open coalescing window.
  const undo = useCallback(() => {
    lastTag.current = null
    dispatch({ type: 'undo' })
  }, [])

  const redo = useCallback(() => {
    lastTag.current = null
    dispatch({ type: 'redo' })
  }, [])

  return {
    present: state.present,
    commit,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
