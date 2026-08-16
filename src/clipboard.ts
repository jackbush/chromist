/**
 * navigator.clipboard needs a secure origin, which rules out plain-http LAN
 * testing on a phone — hence the legacy fallback.
 */
/** How long a copy stays acknowledged. Touch has no hover to end the state, so
 *  the clipboard mark has to time itself out. */
export const COPIED_MS = 1000

export async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
