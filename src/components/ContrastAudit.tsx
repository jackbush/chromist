import { useEffect, useState } from 'react'
import type { Gamut, Pin, Spec, Weight } from '../types'
import { cssVars, deltaE, JND, toGamut, toHex } from '../color'
import {
  apca,
  contrastRatio,
  formatApca,
  formatMinFontSize,
  formatRatio,
  largeTextPx,
  minFontSize,
  scoreFor,
} from '../contrast'
import { simulate, VISIONS, type Vision } from '../cvd'
import { AuditFields, AuditSettingsDialog } from './AuditSettings'
import { GearIcon } from './icons'
import { useIsDesktop } from '../hooks/useIsDesktop'

/** Ordinary web text, and what a band that holds at any size is drawn at —
 *  there is no threshold to show, so it shows the size people actually set. */
const BODY_PX = 16

/** Where there is no size to draw at all: a pair that fails outright, and the
 *  spot-text and non-text findings. WCAG 2's larger definition of large text. */
const FALLBACK_PX = 24

type Props = {
  pins: Pin[]
  vision: Vision
  spec: Spec
  weight: Weight
  gamut: Gamut
  onVisionChange: (vision: Vision) => void
  onSpecChange: (spec: Spec) => void
  onWeightChange: (weight: Weight) => void
  onGamutChange: (gamut: Gamut) => void
  onExit: () => void
  /** The skip link's destination, wherever the grid is standing in for the
   *  palette panes. */
  ref?: React.Ref<HTMLElement>
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
 *
 * One specification at a time, because they disagree and reading them side by
 * side invites treating the disagreement as a single verdict. WCAG 2.2 gives
 * conformance levels, which is what anyone is actually held to. WCAG 3.0's APCA
 * gives a font size, which is the question you had — and it is polarity-aware,
 * so light-on-dark rates far below what the ratio suggests, and the grid stops
 * being symmetric across its diagonal.
 *
 * Both take the font weight, which is why it is one control above and not two:
 * WCAG 2 needs it to know where large text starts, APCA to pick a column. It
 * also sets the weight the verdict itself is drawn in, so the grid keeps
 * demonstrating what it claims.
 *
 * Running underneath either: a cell marked as a pair means the two colours are
 * within a just-noticeable difference of each other — not low contrast, the
 * *same colour*, which no specification catches and which the vision simulation
 * turns up constantly.
 */
export function ContrastAudit({
  pins,
  vision,
  spec,
  weight,
  gamut,
  onVisionChange,
  onSpecChange,
  onWeightChange,
  onGamutChange,
  onExit,
  ref,
}: Props) {
  const isDesktop = useIsDesktop()
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  // Labels name the colour that was chosen; everything measured and everything
  // painted uses the colour as it actually arrives. Screen first, then eye —
  // that is the order it happens in, and a colour past the target's reach is
  // mapped into it before anyone gets a chance to see it.
  const hexes = pins.map((p) => toHex(p.colour).toUpperCase())
  const seen = pins.map((p) => simulate(toGamut(p.colour, gamut), vision))

  return (
    <main className="audit" ref={ref} tabIndex={-1} aria-label="Accessibility audit">
      {/* Desktop lays the four settings along the bar. A phone has room for one
          control there, so it gets the one that opens the rest — the grid is
          what the screen is for, and four dropdowns were taking two rows of it
          at a size nobody could tap accurately. */}
      <div className="audit-bar">
        {isDesktop ? (
          <AuditFields
            spec={spec}
            weight={weight}
            gamut={gamut}
            vision={vision}
            onSpecChange={onSpecChange}
            onWeightChange={onWeightChange}
            onGamutChange={onGamutChange}
            onVisionChange={onVisionChange}
          />
        ) : (
          <button
            type="button"
            className="audit-settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-haspopup="dialog"
          >
            <GearIcon size={16} />
            Accessibility audit settings
          </button>
        )}
      </div>

      {settingsOpen && (
        <AuditSettingsDialog
            spec={spec}
            weight={weight}
            gamut={gamut}
            vision={vision}
            onSpecChange={onSpecChange}
            onWeightChange={onWeightChange}
            onGamutChange={onGamutChange}
            onVisionChange={onVisionChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* The one scroll container in the app: on a phone a seven-colour grid
          runs off both edges, and the labels stay put while it does. */}
      <div className="audit-scroll">
        {/* The row count drives the height each row resolves to. */}
        <table className="audit-grid" style={{ '--rows': pins.length } as React.CSSProperties}>
          {/* What the grid is, for anyone who arrives at it a cell at a time and
              never sees the shape of it. */}
          <caption className="visually-hidden">
            Every colour as text over every colour as background. Rows are the
            background, columns are the text over it.{' '}
            {spec === 'wcag22'
              ? 'Each cell gives the WCAG 2.2 level and the contrast ratio.'
              : 'Each cell gives the smallest font size that passes APCA, and the Lc value.'}
          </caption>
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
                      <td key={col.id} className="audit-cell is-same" style={cssVars(seen[c], gamut)}>
                        <span className="visually-hidden">{hexes[r]} on itself</span>
                      </td>
                    )
                  }

                  const close = deltaE(seen[c], seen[r]) < JND
                  const ratio = contrastRatio(seen[c], seen[r])
                  const lc = apca(seen[c], seen[r])
                  const score = scoreFor(ratio)
                  const smallest = minFontSize(lc, weight)

                  /**
                   * The verdict is drawn at the size it is reporting, so the
                   * cell is the demonstration rather than a description of one.
                   * AA and AAA hold at any size, so they are drawn at ordinary
                   * body text; AA+ at the large-text threshold it depends on;
                   * and anything carrying no text at all at the fallback.
                   */
                  const drawAt =
                    spec === 'wcag30'
                      ? 'px' in smallest
                        ? smallest.px
                        : FALLBACK_PX
                      : score === 'AA+'
                        ? largeTextPx(weight)
                        : score === 'FAIL'
                          ? FALLBACK_PX
                          : BODY_PX

                  return (
                    <td key={col.id} className="audit-cell" style={cssVars(seen[r], gamut)}>
                      {/* Set in the pair's own colours, at the chosen weight and
                          at the size being claimed, so it is legible only if the
                          claim holds — a hairline at 100 being hard to read is
                          the finding, not a fault. When the two are the same
                          colour this band is simply blank, which is also the
                          finding. */}
                      <div
                        className="audit-score"
                        style={
                          {
                            ...cssVars(seen[c], gamut),
                            fontWeight: weight,
                            '--verdict-px': `${drawAt}px`,
                          } as React.CSSProperties
                        }
                      >
                        {spec === 'wcag22' ? score : formatMinFontSize(smallest)}
                      </div>
                      {/* The theme's ink on the theme's paper, and it has to be:
                          a cell reporting that its two colours are one colour
                          cannot report it in either of them. */}
                      <div className="audit-facts">
                        {close ? (
                          <span className="audit-close">
                            same colour
                            <span className="visually-hidden">
                              {' '}
                              as {hexes[r]}
                              {vision === 'normal' ? '' : ` with ${VISIONS[vision].label}`}
                            </span>
                          </span>
                        ) : spec === 'wcag22' ? (
                          <>
                            <span>{formatRatio(ratio)}</span>
                            {/* AA+ is the band that only holds at size, so it is
                                the only one with a size worth quoting. */}
                            {score === 'AA+' && (
                              <span className="audit-apca">≥{largeTextPx(weight)}px</span>
                            )}
                          </>
                        ) : (
                          <span title="APCA lightness contrast, signed for polarity">
                            {formatApca(lc)}
                          </span>
                        )}
                      </div>
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
