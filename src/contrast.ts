import { wcagContrast } from 'culori'
import type { Hsl } from './types'
import { hslToHex } from './color'

/**
 * WCAG 1.4.3 contrast, and the four bands the audit grid reports.
 *
 * The thresholds depend on the size of the text they're judging: 4.5 for AA at
 * body size, but only 3 once text is "large" (18pt regular, or 14pt bold —
 * which is what the grid sets its scores in). AA+ is that middle ground: a pair
 * that passes AA at large sizes and fails it at body size.
 */
export type Score = 'AAA' | 'AA' | 'AA+' | 'FAIL'

export function contrastRatio(a: Hsl, b: Hsl): number {
  return wcagContrast(hslToHex(a), hslToHex(b))
}

export function scoreFor(ratio: number): Score {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA+'
  return 'FAIL'
}

/** Always rounded down, so a cell can never advertise a ratio it hasn't got:
 *  4.499 reads 4.49 beside its AA+, not a 4.50 that looks like a passing AA. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`
}
