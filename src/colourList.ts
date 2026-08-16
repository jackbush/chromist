import { MAX_PINS } from './types'

/**
 * The text form of a palette: one hex code per line. Reading it is deliberately
 * forgiving about how a code is written — with or without the hash, upper or
 * lower case, three digits or six, padded with blank lines — and deliberately
 * strict about what a code means. Anything carrying an alpha channel is
 * rejected rather than quietly flattened, since a palette here has no opacity
 * to give it.
 */

export type ListError = { line: number; message: string }

export type ListResult = {
  /** Six-digit `#rrggbb`, lower case. Empty when anything failed to read. */
  hexes: string[]
  errors: ListError[]
}

const HEX = /^[0-9a-f]+$/i

export function formatColourList(hexes: string[]): string {
  return hexes.map((h) => h.toUpperCase()).join('\n')
}

export function parseColourList(text: string): ListResult {
  const hexes: string[] = []
  const errors: ListError[] = []

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    const body = raw.trim().replace(/^#/, '')
    if (body === '') return // blank lines are spacing, not colours

    if (!HEX.test(body)) {
      errors.push({ line, message: 'not a hex colour' })
      return
    }
    // Four and eight digits are the alpha forms of three and six.
    if (body.length === 4 || body.length === 8) {
      errors.push({ line, message: 'no opacity — drop the last digits' })
      return
    }
    if (body.length !== 3 && body.length !== 6) {
      errors.push({ line, message: 'needs three or six digits' })
      return
    }

    const six =
      body.length === 3
        ? body
            .split('')
            .map((d) => d + d)
            .join('')
        : body

    if (hexes.length >= MAX_PINS) {
      errors.push({ line, message: `over ${MAX_PINS} colours` })
      return
    }
    hexes.push(`#${six.toLowerCase()}`)
  })

  if (hexes.length === 0 && errors.length === 0) {
    errors.push({ line: 1, message: 'needs at least one colour' })
  }

  return { hexes: errors.length > 0 ? [] : hexes, errors }
}
