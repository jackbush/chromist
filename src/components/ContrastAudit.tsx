import { useEffect } from 'react'
import type { Pin } from '../types'
import { hslToCss, hslToHex } from '../color'
import { contrastRatio, formatRatio, scoreFor } from '../contrast'
import { CloseIcon, WarningIcon } from './icons'

type Props = {
  pins: Pin[]
  onClose: () => void
}

/**
 * Every colour against every other: rows are backgrounds, columns are the text
 * laid over them. The scores are set in the colours they describe rather than
 * beside a swatch of them, so the grid is its own evidence — a cell that says
 * AA has to be legible at AA to be read at all.
 */
export function ContrastAudit({ pins, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const hexes = pins.map((p) => hslToHex(p.hsl).toUpperCase())

  return (
    <div className="audit" role="dialog" aria-modal="true" aria-label="Accessibility audit">
      <header className="audit-bar">
        {/* The panel is named to assistive tech by the dialog's own label, so
            the one line here is spent on the thing the grid can't say itself. */}
        <p className="dialog-note audit-note">
          <WarningIcon size={14} />
          AA+ passes AA at large size only.
        </p>
        <button type="button" className="bar-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>

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
    </div>
  )
}
