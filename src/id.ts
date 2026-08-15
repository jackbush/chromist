let counter = 0

/** Stable within a session; ids only need to be unique among at most 7 pins. */
export function newId(): string {
  counter += 1
  return `p${Date.now().toString(36)}${counter.toString(36)}`
}
