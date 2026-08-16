import { parse } from 'culori'
import type { Colour } from './types'
import { MAX_PINS } from './types'
import { parseColour, toListText } from './color'

/**
 * The text form of a palette: one colour per line. Reading it is deliberately
 * forgiving about how a colour is written — with or without the hash, upper or
 * lower case, three digits or six, and any CSS colour function culori can read,
 * so `oklch(0.7 0.15 200)` and `color(display-p3 0 1 0)` paste in as readily as
 * a hex code. It is deliberately strict about what a colour means: anything
 * carrying an alpha channel is rejected rather than quietly flattened, since a
 * palette here has no opacity to give it.
 *
 * Writing it back out uses hex wherever a colour fits in sRGB, because that is
 * what the rest of the world expects, and the wide form only where it must.
 */

export type ListError = { line: number; message: string }

export type ListResult = {
  /** Empty when anything failed to read — the list applies whole or not at all. */
  colours: Colour[]
  errors: ListError[]
}

const BARE_HEX = /^[0-9a-f]+$/i

export function formatColourList(colours: Colour[]): string {
  return colours.map(toListText).join('\n')
}

export function parseColourList(text: string): ListResult {
  const colours: Colour[] = []
  const errors: ListError[] = []

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    const body = raw.trim()
    if (body === '') return // blank lines are spacing, not colours

    const push = (colour: Colour | null, message: string) => {
      if (!colour) {
        errors.push({ line, message })
        return
      }
      if (colours.length >= MAX_PINS) {
        errors.push({ line, message: `over ${MAX_PINS} colours` })
        return
      }
      colours.push(colour)
    }

    // A bare run of hex digits, with or without the hash. Checked before culori
    // so the digit-count advice below stays specific.
    const digits = body.replace(/^#/, '')
    if (BARE_HEX.test(digits)) {
      // Four and eight digits are the alpha forms of three and six.
      if (digits.length === 4 || digits.length === 8) {
        errors.push({ line, message: 'no opacity — drop the last digits' })
        return
      }
      if (digits.length !== 3 && digits.length !== 6) {
        errors.push({ line, message: 'needs three or six digits' })
        return
      }
      push(parseColour(`#${digits}`), 'not a colour')
      return
    }

    const parsed = parse(body)
    if (!parsed) {
      errors.push({ line, message: 'not a colour' })
      return
    }
    if (parsed.alpha !== undefined && parsed.alpha !== 1) {
      errors.push({ line, message: 'no opacity — drop the alpha' })
      return
    }
    push(parseColour(body), 'not a colour')
  })

  if (colours.length === 0 && errors.length === 0) {
    errors.push({ line: 1, message: 'needs at least one colour' })
  }

  return { colours: errors.length > 0 ? [] : colours, errors }
}
