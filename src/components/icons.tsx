/**
 * Icons drawn to match the monospace type rather than a typical rounded UI set:
 * a 24-unit grid, uniform 2-unit strokes, square caps and joins, and only
 * right angles and 45s — no curves, no tapering.
 */

type IconProps = { size?: number; className?: string }

function Icon({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Left arrow turning back on itself, all right angles. */
export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9h13v11" />
      <path d="M9 4 4 9l5 5" />
    </Icon>
  )
}

export function RedoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 9H7v11" />
      <path d="m15 4 5 5-5 5" />
    </Icon>
  )
}

/** Clipboard — board plus clip, shown on hover beside anything copyable. */
export function ClipboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 4H5v17h14V4h-4" />
      <path d="M9 2h6v4H9z" />
    </Icon>
  )
}

/** Pencil — a 45° body on the grid's diagonal, with the nib line across it. */
export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20v-4L16 4l4 4L8 20z" />
      <path d="m14 6 4 4" />
    </Icon>
  )
}

/** Share — the iOS box-with-an-up-arrow, redrawn on the same square grid. */
export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 10H5v12h14V10h-3" />
      <path d="M12 2v13" />
      <path d="m7 7 5-5 5 5" />
    </Icon>
  )
}

/** Sun — a diamond for the disc, since a circle would be the one curve in the
 *  set, with rays on the axes and the diagonals. */
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 7 17 12 12 17 7 12Z" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      <path d="m5 5 2 2M17 17l2 2M19 5l-2 2M5 19l2-2" />
    </Icon>
  )
}

/** Crescent — the same curve drawn as a chamfered sliver: a straight back, a
 *  straight belly four units inside it, and a point at each end. */
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 3 7 9v6l6 6-2-2V5Z" />
    </Icon>
  )
}

export function ResetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 5 14 14M19 5 5 19" />
    </Icon>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M6 7h12v13H6z" />
      <path d="M10 4h4M10 11v5M14 11v5" />
    </Icon>
  )
}
