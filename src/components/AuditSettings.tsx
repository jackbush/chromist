import type { Gamut, Spec, Weight } from '../types'
import { GAMUTS, SPECS, WEIGHTS } from '../types'
import { VISIONS, type Vision } from '../cvd'
import { Modal } from './Modal'

export type AuditSettingsProps = {
  spec: Spec
  weight: Weight
  gamut: Gamut
  vision: Vision
  onSpecChange: (spec: Spec) => void
  onWeightChange: (weight: Weight) => void
  onGamutChange: (gamut: Gamut) => void
  onVisionChange: (vision: Vision) => void
}

/**
 * What the grid is being read against: the specification, the weight both of
 * them need, the screen the colours are landing on, and the eye they are being
 * seen with.
 *
 * The same four controls whether they are laid along the bar or stacked in the
 * dialog — one definition, so the two can't drift into disagreeing about what
 * an option is called.
 */
export function AuditFields({
  spec,
  weight,
  gamut,
  vision,
  onSpecChange,
  onWeightChange,
  onGamutChange,
  onVisionChange,
}: AuditSettingsProps) {
  return (
    <>
      <label className="audit-field">
        <span>WCAG</span>
        <select value={spec} onChange={(e) => onSpecChange(e.target.value as Spec)}>
          {(Object.keys(SPECS) as Spec[]).map((v) => (
            <option key={v} value={v}>
              {SPECS[v].label}
            </option>
          ))}
        </select>
      </label>

      <label className="audit-field">
        <span>Font weight</span>
        <select value={weight} onChange={(e) => onWeightChange(Number(e.target.value) as Weight)}>
          {WEIGHTS.map((w) => (
            <option key={w} value={w}>
              {w}
              {w === 400 ? ' (Normal)' : w === 700 ? ' (Bold)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="audit-field">
        <span>Gamut</span>
        <select value={gamut} onChange={(e) => onGamutChange(e.target.value as Gamut)}>
          {(Object.keys(GAMUTS) as Gamut[]).map((g) => (
            <option key={g} value={g}>
              {GAMUTS[g].label}
            </option>
          ))}
        </select>
      </label>

      <label className="audit-field">
        <span>Simulation</span>
        <select value={vision} onChange={(e) => onVisionChange(e.target.value as Vision)}>
          {(Object.keys(VISIONS) as Vision[]).map((v) => (
            <option key={v} value={v}>
              {VISIONS[v].label}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

/**
 * The same four controls on a phone, where the bar has no room for them.
 *
 * Every change lands on the grid as it is made — there is nothing to submit, so
 * Done only puts the grid back in front of you. At this size the controls can
 * be set at a size worth tapping, which the bar could never give them.
 */
export function AuditSettingsDialog({
  onClose,
  ...fields
}: AuditSettingsProps & { onClose: () => void }) {
  return (
    <Modal
      title="Accessibility audit settings"
      titleId="audit-settings-title"
      onClose={onClose}
      actions={
        <button type="button" className="dialog-btn is-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      {/* One setting per line, and one grid across all four so the controls
          line up under each other rather than each starting wherever its own
          label happens to end. */}
      <div className="audit-settings">
        <AuditFields {...fields} />
      </div>
    </Modal>
  )
}
