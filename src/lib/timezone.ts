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

const TZ_KEY = 'far135_tz'

export function loadTz(): string {
  return localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function saveTz(tz: string): void {
  localStorage.setItem(TZ_KEY, tz)
}

// Short zone name (e.g. PDT / PST). Pass the YYYY-MM-DD date being entered so a
// December date reads PST even when today is in daylight time.
export function tzAbbr(tz: string, date?: string): string {
  const at = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : new Date()
  return (
    Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(at)
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

function normTime(timeStr: string): string {
  return timeStr.length === 4 ? `${timeStr.slice(0, 2)}:${timeStr.slice(2)}` : timeStr
}

// Convert a local date + time (in given timezone) to a UTC ISO string ending in "Z".
// Returns '' for missing or invalid input, and for a local time that doesn't exist
// because the clocks spring forward over it (see nonexistentLocalTime). A time that
// occurs twice when clocks fall back resolves to the first (daylight-time) one.
export function localToUtcIso(dateStr: string, timeStr: string, tz: string): string {
  if (!dateStr || !timeStr) return ''
  const norm = normTime(timeStr)
  if (!/^\d{2}:\d{2}$/.test(norm)) return ''
  const approx = Date.parse(`${dateStr}T${norm}:00Z`)
  if (isNaN(approx)) return ''
  // Two-pass: first approximation, then refine for DST boundary accuracy.
  const utcMs = approx - offsetMs(approx - offsetMs(approx, tz), tz)
  const d = new Date(utcMs)
  const p = (n: number) => String(n).padStart(2, '0')
  const iso = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`
  // A spring-forward gap time converts to a different local time; reject it.
  const back = utcToLocalParts(iso, tz)
  return back && back.date === dateStr && back.time === norm ? iso : ''
}

// True when the local date + time is well-formed but doesn't exist in the
// timezone, because clocks spring forward over it (e.g. 02:30 on the US DST start day).
export function nonexistentLocalTime(dateStr: string, timeStr: string, tz: string): boolean {
  if (!dateStr || !timeStr) return false
  const norm = normTime(timeStr)
  if (!/^\d{2}:\d{2}$/.test(norm) || isNaN(Date.parse(`${dateStr}T${norm}:00Z`))) return false
  return localToUtcIso(dateStr, timeStr, tz) === ''
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

// Explains why a typed local time can't be saved, or null if it's fine.
export function localTimeHint(date: string, time: string, tz: string): string | null {
  return nonexistentLocalTime(date, time, tz)
    ? `${time} doesn't exist on ${date}: clocks spring forward over it. Use the time after the change.`
    : null
}

// Calendar period boundaries (months, quarters, years) are defined in the
// user's selected timezone. This is the single source of truth for them —
// to switch the whole app to Zulu-calendar periods, change it here.
// Returns local midnight on the 1st of the month as UTC ms. monthIdx is
// 0-based and may overflow (12 → January of the next year). Without tz,
// falls back to the device's local timezone.
export function monthStartMs(year: number, monthIdx: number, tz?: string): number {
  const y = year + Math.floor(monthIdx / 12)
  const m = ((monthIdx % 12) + 12) % 12
  if (!tz) return new Date(y, m, 1).getTime()
  return Date.parse(localToUtcIso(`${y}-${String(m + 1).padStart(2, '0')}-01`, '00:00', tz))
}

// Current year and 0-based month in the selected timezone.
export function localYearMonth(tz: string, now: Date = new Date()): { year: number; monthIdx: number } {
  const date = utcToLocalParts(now.toISOString(), tz)?.date ?? now.toISOString().slice(0, 10)
  return { year: Number(date.slice(0, 4)), monthIdx: Number(date.slice(5, 7)) - 1 }
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
