// "How to use" appears on the main page on first launch only; it's always in the menu.
const SEEN_KEY = 'far135_howto_seen'

// First launch = this device has never shown it and has no logged entries.
export function isFirstLaunch(entryCount: number): boolean {
  try { return !localStorage.getItem(SEEN_KEY) && entryCount === 0 } catch { return false }
}

export function markHowToSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
    localStorage.removeItem('far135_howto_collapsed')   // from the old collapsible card
  } catch { /* localStorage unavailable */ }
}
