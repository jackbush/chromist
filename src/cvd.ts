import { converter } from 'culori'
import type { Colour } from './types'

/**
 * Colour-vision deficiency simulation.
 *
 * Roughly one man in twelve and one woman in two hundred sees a narrower range
 * of colour than a palette is usually designed against, and the failure is
 * almost never caught by a contrast check: two colours can be miles apart in
 * lightness-independent terms and land on the same point for a deuteranope.
 *
 * The matrices are Machado, Oliveira and Fernandes (2009) at full severity, and
 * they operate on *linear* RGB — applying them to gamma-encoded values is the
 * usual way this is got wrong, and it produces results that are too dark and
 * too saturated.
 */

export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan'

/**
 * Shares of the whole population, not of men — the red-green figures are
 * sex-linked and usually quoted for males alone, which roughly doubles them.
 *
 * These are dichromacy: a cone missing outright, which is what the matrices
 * below simulate. The far larger number people remember — around 8% of men —
 * counts anomalous trichromacy too, where a cone is shifted rather than absent.
 * Deuteranomaly alone is most of that 8%, and nothing here simulates it.
 */
export const VISIONS: Record<Vision, { label: string }> = {
  normal: { label: 'None' },
  protan: { label: 'Protanopia (0.5%)' },
  deutan: { label: 'Deuteranopia (0.6%)' },
  tritan: { label: 'Tritanopia (0.01%)' },
}

type Matrix = [number, number, number, number, number, number, number, number, number]

const MATRICES: Record<Exclude<Vision, 'normal'>, Matrix> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

const toLinear = converter('lrgb')
const toOklab = converter('oklab')

/** The colour as that eye would receive it. `normal` is the identity, so
 *  callers can map a palette through this unconditionally. */
export function simulate(colour: Colour, vision: Vision): Colour {
  if (vision === 'normal') return colour

  const { r, g, b } = toLinear({ mode: 'oklab', ...colour })
  const m = MATRICES[vision]
  const out = toOklab({
    mode: 'lrgb',
    r: m[0] * r + m[1] * g + m[2] * b,
    g: m[3] * r + m[4] * g + m[5] * b,
    b: m[6] * r + m[7] * g + m[8] * b,
  })
  return { l: out.l ?? 0, a: out.a ?? 0, b: out.b ?? 0 }
}
