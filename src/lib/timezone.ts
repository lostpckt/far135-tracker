import type { Entry } from '@/types/entry'

export const TIMEZONES = [
  { value: 'UTC',                 label: 'UTC / Zulu' },
  { value: 'America/New_York',    label: 'Eastern (ET)' },
  { value: 'America/Chicago',     label: 'Central (CT)' },
  { value: 'America/Denver',      label: 'Mountain (MT)' },
  { value: 'America/Phoenix',     label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HT)' },
  { value: 'America/Adak',        label: 'Hawaii-Aleutian (HAT)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic (AT)' },
]

const TZ_KEY        = 'far135_tz'
const MIGRATION_KEY = 'far135_tz_migrated'

export function loadTz(): string {
  return localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function saveTz(tz: string): void {
  localStorage.setItem(TZ_KEY, tz)
}

export function isMigrated(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === '1'
}

export function setMigrated(): void {
  localStorage.setItem(MIGRATION_KEY, '1')
}

export function tzAbbr(tz: string): string {
  return (
    Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value ?? tz
  )
}

// Get UTC offset in ms for a given UTC timestamp in the target timezone.
function offsetMs(utcMs: number, tz: string): number {
  const pts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, hourCycle: 'h23',
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => parseInt(pts.find(p => p.type === t)?.value ?? '0')
  const h = g('hour') === 24 ? 0 : g('hour')
  return Date.UTC(g('year'), g('month') - 1, g('day'), h, g('minute'), g('second')) - utcMs
}

// Convert a local date + time (in given timezone) to a UTC ISO string ending in "Z".
export function localToUtcIso(dateStr: string, timeStr: string, tz: string): string {
  if (!dateStr || !timeStr) return ''
  const norm = timeStr.length === 4
    ? `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`
    : timeStr
  if (!/^\d{2}:\d{2}$/.test(norm)) return ''
  const approx = Date.parse(`${dateStr}T${norm}:00Z`)
  if (isNaN(approx)) return ''
  // Two-pass: first approximation, then refine for DST boundary accuracy.
  const utcMs = approx - offsetMs(approx - offsetMs(approx, tz), tz)
  const d = new Date(utcMs)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`
}

// Split a UTC ISO string into local date and time parts for editing.
export function utcToLocalParts(utcStr: string, tz: string): { date: string; time: string } | null {
  if (!utcStr) return null
  const d = new Date(utcStr)
  if (isNaN(d.getTime())) return null
  const pts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23',
  }).formatToParts(d)
  const g    = (t: string) => pts.find(p => p.type === t)?.value ?? ''
  const hour = g('hour') === '24' ? '00' : g('hour')
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hour}:${g('minute')}` }
}

// Split a stored date/time string (UTC ISO with Z, or legacy local "date T time") into
// local date and time parts for populating an edit form.
export function splitForEdit(val: string, tz: string): { d: string; t: string } {
  if (!val) return { d: '', t: '' }
  if (val.endsWith('Z')) {
    const parts = utcToLocalParts(val, tz)
    return parts ? { d: parts.date, t: parts.time } : { d: '', t: '' }
  }
  const idx = val.indexOf('T')
  return idx >= 0 ? { d: val.slice(0, idx), t: val.slice(idx + 1) } : { d: val, t: '' }
}

// Convert stored entries from local time (no Z suffix) to UTC (Z suffix).
// Rest-day entries are skipped — their showTime is a calendar date marker, not a timestamp.
export function migrateEntries(entries: Entry[], tz: string): Entry[] {
  return entries.map(e => {
    if (e.restDay) return e
    const conv = (val: string): string => {
      if (!val || val.endsWith('Z')) return val
      const idx = val.indexOf('T')
      if (idx < 0) return val
      return localToUtcIso(val.slice(0, idx), val.slice(idx + 1), tz) || val
    }
    return {
      ...e,
      showTime:    conv(e.showTime),
      releaseTime: conv(e.releaseTime),
      restStart:   conv(e.restStart),
      restEnd:     conv(e.restEnd),
    }
  })
}
