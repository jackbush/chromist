import { useEffect, useState } from 'react'

/**
 * How much of the layout viewport the on-screen keyboard is covering, in px.
 *
 * iOS Safari doesn't shrink the layout viewport when the keyboard opens, so a
 * `position: fixed` full-screen dialog keeps its full height and the keyboard
 * lands on top of whatever sits at its foot. The *visual* viewport does shrink,
 * and the strip left below it is exactly the part that can't be seen.
 *
 * Zero where the browser resizes the layout instead (Chrome on Android, and
 * desktop), because there the difference is already gone.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const measure = () => {
      // offsetTop matters because iOS scrolls the visible band up the page to
      // keep the focused field clear: the hidden strip is what's left below
      // that band, not the height difference on its own.
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop
      // Fractional viewport heights are routine; half a pixel isn't a keyboard.
      setInset(hidden > 1 ? hidden : 0)
    }

    measure()
    viewport.addEventListener('resize', measure)
    viewport.addEventListener('scroll', measure)
    return () => {
      viewport.removeEventListener('resize', measure)
      viewport.removeEventListener('scroll', measure)
    }
  }, [])

  return inset
}
