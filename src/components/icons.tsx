/**
 * Icons drawn to match the monospace type rather than a typical rounded UI set:
 * a 24-unit grid, uniform 2-unit strokes, square caps and joins, and only
 * right angles and 45s — no curves, no tapering.
 */

type IconProps = { size?: number }

function Icon({ size = 18, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
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

/** Sliders — squared off, where a cog would have to be all curves. */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7h18M3 17h18" />
      <path d="M8 4v6M16 14v6" />
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
