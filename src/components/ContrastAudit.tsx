import { useEffect } from 'react'
import type { Pin } from '../types'
import { hslToCss, hslToHex } from '../color'
import { contrastRatio, formatRatio, scoreFor } from '../contrast'

type Props = {
  pins: Pin[]
  onExit: () => void
}

/**
 * Every colour against every other: rows are backgrounds, columns are the text
 * laid over them. The scores are set in the colours they describe rather than
 * beside a swatch of them, so the grid is its own evidence — a cell that says
 * AA has to be legible at AA to be read at all.
 *
 * This takes the place of the palette panes rather than covering them: the
 * action bar above stays live, so a colour can be edited, undone or shared
 * without leaving the reading of it.
 */
export function ContrastAudit({ pins, onExit }: Props) {
  // Nothing is trapped here, but escape means the same as it does everywhere
  // else in the app: back to where you were.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // The bar still works from in here, so a dialog can be open over the
      // grid. It answers escape first, and alone — one press, one step back.
      if (document.querySelector('.dialog-backdrop')) return
      onExit()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onExit])

  const hexes = pins.map((p) => hslToHex(p.hsl).toUpperCase())

  return (
    <main className="audit" aria-label="Accessibility audit">
      {/* The one scroll container in the app: on a phone a seven-colour grid
          runs off both edges, and the labels stay put while it does. */}
      <div className="audit-scroll">
        {/* The row count drives the height each row resolves to. */}
        <table className="audit-grid" style={{ '--rows': pins.length } as React.CSSProperties}>
          <thead>
            <tr>
              <th className="audit-head audit-corner">
                <span className="visually-hidden">Text colour over background colour</span>
              </th>
              {hexes.map((hex, i) => (
                <th key={pins[i].id} scope="col" className="audit-head">
                  {hex}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pins.map((row, r) => (
              <tr key={row.id}>
                <th scope="row" className="audit-head">
                  {hexes[r]}
                </th>
                {pins.map((col, c) => {
                  // A colour against itself has no contrast to report, so the
                  // diagonal shows the colour itself instead.
                  if (r === c) {
                    return (
                      <td
                        key={col.id}
                        className="audit-cell is-same"
                        style={{ background: hslToCss(col.hsl) }}
                      >
                        <span className="visually-hidden">{hexes[r]} on itself</span>
                      </td>
                    )
                  }

                  const ratio = contrastRatio(col.hsl, row.hsl)
                  return (
                    <td
                      key={col.id}
                      className="audit-cell"
                      style={{ background: hslToCss(row.hsl) }}
                    >
                      <div className="audit-score" style={{ color: hslToCss(col.hsl) }}>
                        {scoreFor(ratio)}
                      </div>
                      <div className="audit-ratio">{formatRatio(ratio)}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
