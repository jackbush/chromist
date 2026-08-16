/**
 * Says out loud what the app only showed.
 *
 * A copy flashes the cell, a reorder slides the tiles, a delete takes one away
 * — all of it invisible to a screen reader, and none of it worth moving focus
 * for. WCAG calls these status messages: announced where the user is, without
 * interrupting them.
 *
 * One region for the app, made on first use and left in place. It lives outside
 * the React tree because the things worth announcing happen in half a dozen
 * components that have no business threading a callback between them.
 */

let region: HTMLElement | null = null
let clearTimer: number | null = null

function ensureRegion(): HTMLElement {
  if (region?.isConnected) return region
  region = document.createElement('p')
  region.className = 'visually-hidden'
  // Polite: it waits for the reader to finish rather than cutting in.
  region.setAttribute('role', 'status')
  region.setAttribute('aria-live', 'polite')
  document.body.appendChild(region)
  return region
}

export function announce(message: string): void {
  const el = ensureRegion()
  // Writing the same text twice is a no-op to a screen reader — copying the
  // same colour again has to read as a second copy, so the region is emptied
  // first and filled on the next frame.
  el.textContent = ''
  if (clearTimer) window.clearTimeout(clearTimer)
  requestAnimationFrame(() => {
    el.textContent = message
  })
  // Left in place long enough to be read, then cleared: a stale message that
  // gets re-read when the user next moves through the page is worse than none.
  clearTimer = window.setTimeout(() => {
    el.textContent = ''
  }, 5000)
}
