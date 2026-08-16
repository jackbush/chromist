import { useEffect } from 'react'
import type { ThemeName } from '../types'
import { THEMES } from '../types'

/**
 * Points the browser's own furniture — Safari's bars, the Android status bar,
 * native scrollbars, overscroll — at the theme the app is actually wearing.
 *
 * The tags in the document (from site.config.ts) answer per OS scheme, which is
 * all that can be known before the app boots. After that it's the wrong
 * question: the palette's theme is a setting of its own, so a white app under a
 * dark system was leaving the phone's bars black.
 *
 * Every theme-color tag is written, matched media or not — the browser takes
 * the first whose media applies, so leaving any of them stale would let the old
 * colour win.
 */
export function useThemeColor(theme: ThemeName): void {
  useEffect(() => {
    const { bg } = THEMES[theme]
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', bg)
    }
    // theme-color doesn't reach form controls or the overscroll area; this does.
    document.documentElement.style.colorScheme = theme === 'white' ? 'light' : 'dark'
  }, [theme])
}
