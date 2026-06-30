import type { Entry } from '@/types/entry'
import { ENTRY_VALIDATION_VERSION, VALIDATION_RESET_EPOCH } from '@/types/entry'
import { checkRestOverlapForEntry } from '@/lib/calculations'

const KEY             = 'far135_v1'
const BULK_VALID_KEY  = 'far135_bulk_validated'
const EXPECTED        = `${VALIDATION_RESET_EPOCH}.${ENTRY_VALIDATION_VERSION}`

export function loadEntries(): Entry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveEntries(entries: Entry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

// Run once on startup. Returns updated entries if a scan was needed, or null to
// signal "no scan required — caller should use entries as-is."
// Persists updated entries and marks the scan complete internally.
export function runBulkValidationIfNeeded(entries: Entry[]): Entry[] | null {
  const stored = localStorage.getItem(BULK_VALID_KEY)
  if (stored === EXPECTED) return null

  const [storedEpoch] = (stored ?? '').split('.').map(Number)
  const fullReset = storedEpoch !== VALIDATION_RESET_EPOCH

  const working: Entry[] = fullReset
    ? entries.map(e => ({ ...e, validationVersion: undefined }))
    : entries

  const validated = working.map(entry => {
    const passes = checkRestOverlapForEntry(entry, working)
    return passes
      ? { ...entry, validationVersion: ENTRY_VALIDATION_VERSION }
      : entry
  })

  saveEntries(validated)
  localStorage.setItem(BULK_VALID_KEY, EXPECTED)
  return validated
}
