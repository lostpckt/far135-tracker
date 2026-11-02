import type { Entry } from '@/types/entry'

// Lossless backup of everything needed to rebuild the app's data on another
// device or after the browser clears storage. Unlike the CSV export (meant for
// spreadsheets), this stores every Entry field exactly as saved, so a restore
// is an exact copy — no re-derived fields, no spreadsheet date mangling.

const FORMAT  = 'far135-backup'
const VERSION = 1

const LAST_BACKUP_KEY   = 'far135_last_backup'
const BACKUP_DUTIES_KEY = 'far135_backup_duties'    // duty entries in the log at the last backup
const REMINDER_KEY      = 'far135_backup_reminder'  // the user's reminder setting

// Remind after this many days or this many new duty entries, whichever comes first.
// The choices stop at 14 days / 20 entries so the reminder can't be pushed out further.
export interface ReminderSetting { days: number; duties: number }
export const REMINDER_DAY_CHOICES  = [1, 3, 7, 10, 14]
export const REMINDER_DUTY_CHOICES = [5, 10, 15, 20]
const DEFAULT_REMINDER: ReminderSetting = { days: 14, duties: 20 }

export function loadReminderSetting(): ReminderSetting {
  try {
    const r = JSON.parse(localStorage.getItem(REMINDER_KEY) || 'null')
    return {
      days:   REMINDER_DAY_CHOICES.includes(r?.days)    ? r.days   : DEFAULT_REMINDER.days,
      duties: REMINDER_DUTY_CHOICES.includes(r?.duties) ? r.duties : DEFAULT_REMINDER.duties,
    }
  } catch { return DEFAULT_REMINDER }
}

export function saveReminderSetting(r: ReminderSetting) {
  try { localStorage.setItem(REMINDER_KEY, JSON.stringify(r)) } catch { /* localStorage unavailable */ }
}

/** Duty entries (legs sharing Show and Release count once). */
export function dutyCount(entries: Entry[]): number {
  return new Set(entries.filter(e => !e.restDay).map(e => `${e.showTime}|${e.releaseTime}`)).size
}

function recordBackupDuties(n: number) {
  try { localStorage.setItem(BACKUP_DUTIES_KEY, String(n)) } catch { /* localStorage unavailable */ }
}

/**
 * Duty entries in the log at the last backup. Devices that backed up before
 * this was tracked start counting from now, so they aren't nagged at once.
 */
export function backupDuties(entries: Entry[]): number {
  try {
    const v = Number(localStorage.getItem(BACKUP_DUTIES_KEY))
    if (localStorage.getItem(BACKUP_DUTIES_KEY) !== null && Number.isFinite(v)) return v
  } catch { /* localStorage unavailable */ }
  const n = dutyCount(entries)
  if (lastBackupMs() !== null) recordBackupDuties(n)
  return n
}

export interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: string   // UTC ISO timestamp
  settings: { tz: string }
  entries: Entry[]
}

export interface ParsedBackup {
  entries: Entry[]
  tz: string
  exportedAt: string
}

export function buildBackup(entries: Entry[], tz: string): BackupFile {
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), settings: { tz }, entries }
}

const STRING_FIELDS = ['id', 'pilot', 'showTime', 'releaseTime', 'dep', 'arr', 'offBlocks', 'onBlocks', 'restStart', 'restEnd', 'reason'] as const
const OPTIONAL_STRING_FIELDS = ['tailNumber', 'entity', 'showTz', 'releaseTz', 'restDayEnd'] as const

// Returns a description of what's wrong with the entry, or null if it's valid.
function entryProblem(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return 'not an object'
  const r = e as Record<string, unknown>
  for (const f of STRING_FIELDS) if (typeof r[f] !== 'string') return `"${f}" missing or not text`
  for (const f of OPTIONAL_STRING_FIELDS) if (r[f] !== undefined && typeof r[f] !== 'string') return `"${f}" not text`
  if (r.crew !== 'S' && r.crew !== 'D') return '"crew" must be S or D'
  if (typeof r.part91 !== 'boolean') return '"part91" missing or not true/false'
  if (typeof r.restDay !== 'boolean') return '"restDay" missing or not true/false'
  if (r.validationVersion !== undefined && typeof r.validationVersion !== 'number') return '"validationVersion" not a number'
  return null
}

// All-or-nothing: any invalid entry rejects the whole file, so a restore can
// never silently drop records.
export function parseBackup(text: string): ParsedBackup | { error: string } {
  let data: unknown
  try { data = JSON.parse(text) } catch { return { error: 'This file is not a valid backup (could not be read as JSON).' } }

  const d = data as Partial<BackupFile> | null
  if (!d || d.format !== FORMAT) return { error: 'This file is not a FAR 135 tracker backup.' }
  if (typeof d.version !== 'number' || d.version > VERSION) {
    return { error: 'This backup was made by a newer version of the app. Update the app, then try again.' }
  }
  if (!Array.isArray(d.entries)) return { error: 'Backup file is damaged: entry list is missing.' }

  for (let i = 0; i < d.entries.length; i++) {
    const problem = entryProblem(d.entries[i])
    if (problem) return { error: `Backup file is damaged: entry ${i + 1} has ${problem}. Nothing was restored.` }
  }
  const ids = new Set(d.entries.map(e => e.id))
  if (ids.size !== d.entries.length) return { error: 'Backup file is damaged: duplicate entry IDs. Nothing was restored.' }

  return {
    entries: d.entries,
    tz: typeof d.settings?.tz === 'string' ? d.settings.tz : '',
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : '',
  }
}

// iPhone, plus iPad — iPadOS Safari reports a Mac user agent, so detect it by touch support.
function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

// Saves a file to the user. On iOS, uses the share sheet so the file can go to
// Files / iCloud Drive (plain downloads are unreliable in home-screen apps).
// Elsewhere, a normal download. Resolves true if the file was handed off, false
// if the user cancelled the share sheet. Must be called directly from a click
// handler (no awaits before it) so the share sheet is allowed to open.
export async function saveFile(content: string, filename: string, type: string): Promise<boolean> {
  const file = new File([content], filename, { type })
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false
      // Share failed for another reason — fall through to a normal download.
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return true
}

export async function downloadBackup(entries: Entry[], tz: string): Promise<boolean> {
  const json = JSON.stringify(buildBackup(entries, tz), null, 2)
  const saved = await saveFile(json, `far135_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  if (saved) {
    try { localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()) } catch { /* localStorage unavailable */ }
    recordBackupDuties(dutyCount(entries))
  }
  return saved
}

// After a restore, the file just restored from is itself a backup that exists
// outside the browser, so count it — but never move the date backwards.
// Returns the resulting last-backup time.
export function recordRestoredBackup(exportedAt: string, entries: Entry[]): number | null {
  recordBackupDuties(dutyCount(entries))   // the log now matches the restored file
  const t = Date.parse(exportedAt)
  const current = lastBackupMs()
  if (Number.isNaN(t) || (current !== null && current >= t)) return current
  try { localStorage.setItem(LAST_BACKUP_KEY, new Date(t).toISOString()) } catch { /* localStorage unavailable */ }
  return t
}

export function lastBackupMs(): number | null {
  try {
    const v = localStorage.getItem(LAST_BACKUP_KEY)
    const t = v ? Date.parse(v) : NaN
    return Number.isNaN(t) ? null : t
  } catch { return null }
}

// Asks the browser not to evict this site's storage under pressure or after
// inactivity (Safari's 7-day rule). Best effort: the browser may say no, and
// it's a no-op where unsupported.
export function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => { /* unsupported or denied */ })
}
