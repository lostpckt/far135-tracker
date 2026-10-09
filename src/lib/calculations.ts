import type { Entry, Computed } from '@/types/entry'
import { monthStartMs } from '@/lib/timezone'
import { saveFile } from '@/lib/backup'

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function ms(dtStr: string | undefined | null): number | null {
  if (!dtStr) return null
  const t = new Date(dtStr).getTime()
  return isNaN(t) ? null : t
}

export function hrs(startMs: number | null, endMs: number | null): number | null {
  if (startMs === null || endMs === null) return null
  const h = (endMs - startMs) / 3600000
  return h >= 0 ? h : null
}

export function fmtHrs(h: number | null | undefined): string {
  if (h === null || h === undefined || isNaN(h)) return '—'
  // Round to whole minutes first, so e.g. 1.9999 h reads "2h 00m", never "1h 60m".
  const total = Math.round(h * 60)
  const hh = Math.floor(total / 60)
  const mm = total - hh * 60
  return `${hh}h ${String(mm).padStart(2, '0')}m`
}

export function fmtDT(dtStr: string | undefined | null): string {
  if (!dtStr) return '—'
  const d = new Date(dtStr)
  if (isNaN(d.getTime())) return '—'
  const utc = dtStr.endsWith('Z')
  const mo = String(utc ? d.getUTCMonth() + 1 : d.getMonth() + 1).padStart(2, '0')
  const dy = String(utc ? d.getUTCDate()       : d.getDate()).padStart(2, '0')
  const hh = String(utc ? d.getUTCHours()      : d.getHours()).padStart(2, '0')
  const mi = String(utc ? d.getUTCMinutes()    : d.getMinutes()).padStart(2, '0')
  return utc ? `${mo}/${dy} ${hh}:${mi}Z` : `${mo}/${dy} ${hh}:${mi}`
}


/** Parse a Hobbs meter reading string into a float, or null if invalid. */
export function parseHobbs(val: string | undefined | null): number | null {
  if (!val) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

/**
 * Round an hours value to 0.01 h. Hobbs readings are decimal (tenths), but their
 * floating-point differences aren't exact (2.3 h computes as 2.2999999999992724),
 * so sums that are exactly at a limit could land a hair over it (8.000000000000028)
 * and falsely read as EXCEEDED. Rounding every flight time and every sum keeps
 * limit comparisons exact.
 */
export function roundHrs(h: number): number {
  return Math.round(h * 100) / 100
}

/** Flight time from Hobbs readings: onHobbs - offHobbs. */
export function hobbsFlightTime(offHobbs: number | null, onHobbs: number | null): number | null {
  if (offHobbs === null || onHobbs === null) return null
  const diff = onHobbs - offHobbs
  if (diff < 0) return null
  return roundHrs(diff)
}

const HOUR = 3600000
const DAY  = 86400000

// ── Rest model ───────────────────────────────────────────────────────────────
// Rest is the time between one duty period's release and the next duty period's
// show. Part 91 duty is still duty, so a Part 91 show ends a rest too. This
// assumes the log records all duty (there is no standby or on-call time).
// Before the first logged duty, rest is unknown. Legacy rest-day entries
// (restDay) and the legacy restStart/restEnd fields are ignored.

interface DutyPeriodSpan {
  show: number
  release: number
  f135: number    // Part 135 flight time in this duty period, h
}

interface DutyIndex {
  periods: DutyPeriodSpan[]          // sorted by show
  byKey: Map<string, number>         // dutyKey(entry) → index in periods
}

function dutyKey(e: Entry): string {
  return `${e.showTime}|${e.releaseTime ?? ''}`
}

// compute() is called once per entry with the same `all` array, so build the
// index once per array. App state replaces the array on every change.
const dutyIndexCache = new WeakMap<Entry[], DutyIndex>()

function dutyIndex(all: Entry[]): DutyIndex {
  const cached = dutyIndexCache.get(all)
  if (cached) return cached
  const map = new Map<string, DutyPeriodSpan>()
  for (const e of all) {
    if (e.restDay) continue
    const show = ms(e.showTime)
    if (show === null) continue
    const key = dutyKey(e)
    let dp = map.get(key)
    if (!dp) { dp = { show, release: ms(e.releaseTime) ?? show, f135: 0 }; map.set(key, dp) }
    if (!e.part91) dp.f135 = roundHrs(dp.f135 + (hobbsFlightTime(parseHobbs(e.offBlocks), parseHobbs(e.onBlocks)) ?? 0))
  }
  const keys = [...map.keys()].sort((a, b) => map.get(a)!.show - map.get(b)!.show)
  const idx: DutyIndex = { periods: keys.map(k => map.get(k)!), byKey: new Map(keys.map((k, i) => [k, i])) }
  dutyIndexCache.set(all, idx)
  return idx
}

/**
 * True if a duty period from `show` to `release` would overlap a different
 * logged duty period. Legs with the same show and release are the same duty
 * period, not an overlap. Rest is measured between duty periods, so they must
 * not overlap.
 */
export function overlappingDuty(all: Entry[], show: string, release: string, excludeIds: Set<string>): boolean {
  const s = ms(show), r = ms(release)
  if (s === null || r === null) return false
  return all.some(e => {
    if (e.restDay || excludeIds.has(e.id) || (e.showTime === show && e.releaseTime === release)) return false
    const es = ms(e.showTime), er = ms(e.releaseTime) ?? es
    return es !== null && er !== null && es < r && s < er
  })
}

/**
 * True if a duty period's total flight time (all legs, Part 91 included) is
 * longer than the duty period itself — always a data-entry error, usually a
 * mistyped Hobbs reading.
 */
export function flightExceedsDuty(show: string, release: string, flightHrs: number): boolean {
  const s = ms(show), r = ms(release)
  return s !== null && r !== null && roundHrs(flightHrs) > (r - s) / HOUR
}

/** The rest gaps between consecutive duty periods, as [release, next show] ms. */
function restGaps(periods: DutyPeriodSpan[]): [number, number][] {
  const gaps: [number, number][] = []
  for (let i = 0; i + 1 < periods.length; i++) gaps.push([periods[i].release, Math.max(periods[i].release, periods[i + 1].show)])
  return gaps
}

/**
 * Number of §135.267(f) rest periods — each full 24 consecutive hours of rest —
 * that fall within [start, end). A rest crossing the window edge is split there,
 * so every 24 h credited lies wholly inside the window. Pass `now` to also count
 * the rest in progress since the last release.
 */
export function restPeriodsInWindow(all: Entry[], start: number, end: number, now?: number): number {
  const { periods } = dutyIndex(all)
  const gaps = restGaps(periods)
  const last = periods.at(-1)
  if (last && now !== undefined && now > last.release) gaps.push([last.release, now])
  return gaps.reduce((n, [a, b]) => n + Math.max(0, Math.floor((Math.min(b, end) - Math.max(a, start)) / DAY)), 0)
}

export function compute(entry: Entry, all: Entry[]): Computed {
  const c = {} as Computed

  const offHobbs = parseHobbs(entry.offBlocks)
  const onHobbs  = parseHobbs(entry.onBlocks)
  const showMs   = ms(entry.showTime)
  const relMs    = ms(entry.releaseTime)

  // This entry's duty period, and the duty periods either side of it.
  const { periods, byKey } = dutyIndex(all)
  const dpIdx = byKey.get(dutyKey(entry)) ?? -1
  const dp    = dpIdx >= 0 ? periods[dpIdx] : null
  const prev  = dpIdx > 0 ? periods[dpIdx - 1] : null
  const next  = dpIdx >= 0 && dpIdx + 1 < periods.length ? periods[dpIdx + 1] : null

  // Flight time from Hobbs; duty from show/release; rest from release to the next show
  c.legFlight  = hobbsFlightTime(offHobbs, onHobbs)
  c.dutyPeriod = hrs(showMs, relMs)
  c.consRest   = dp && next ? Math.max(0, next.show - dp.release) / HOUR : null
  c.maxFlight  = entry.crew === 'D' ? 10 : 8
  c.dutyFlight = dp ? dp.f135 : null

  // Rolling 24-hr window anchored to releaseTime (or showTime fallback) since Hobbs has no timestamp.
  // Computed before the Part 91 check so the dashboard reflects accumulated Part 135 hours
  // even when the most recent leg is a Part 91 repositioning flight.
  const anchorMs = relMs ?? showMs
  if (anchorMs !== null) {
    const windowStart = anchorMs - 86400000
    c.rolling24 = roundHrs(all.reduce((sum, e) => {
      if (e.part91) return sum
      const eAnchor = ms(e.releaseTime) ?? ms(e.showTime)
      if (eAnchor === null || eAnchor > anchorMs || eAnchor <= windowStart) return sum
      return sum + (hobbsFlightTime(parseHobbs(e.offBlocks), parseHobbs(e.onBlocks)) ?? 0)
    }, 0))
  } else {
    c.rolling24 = null
  }

  if (entry.part91) {
    c.excAmt     = 0
    c.reqRest    = null
    c.lookbackOk = null
    c.flightOk   = null
    c.dutyOk     = null
    c.restOk     = null
    c.cQualifies = null
    return c
  }

  // §135.267(c): the (b) 24-hour limits may be exceeded when the flight time is
  // within a regularly assigned duty period of no more than 14 h that is
  // immediately preceded and followed by at least 10 consecutive hours of rest,
  // and the duty period's flight time stays within 8 h (1 pilot) / 10 h (2).
  // (c)(3) "combined duty and rest periods equal 24 hours" is read as the 14/10
  // structure itself (user's operator reading, 2026-10-08).
  // A rest in progress after the latest duty counts as "followed by" for now; it
  // is re-judged as soon as the next duty is logged.
  const restBefore = dp && prev ? (dp.show - prev.release) / HOUR : null
  c.cQualifies = dp !== null
    && c.dutyPeriod !== null && c.dutyPeriod <= 14
    && restBefore !== null && restBefore >= 10
    && (c.consRest === null || c.consRest >= 10)
    && dp.f135 <= c.maxFlight

  // Under (c) the duty period's own flight time is what's limited; otherwise
  // the (b) rolling 24-hour total is.
  c.excAmt = c.cQualifies ? 0
    : c.rolling24 !== null ? roundHrs(Math.max(0, c.rolling24 - c.maxFlight)) : 0

  // §135.267(e): exceeded by not more than 30 min → 11 h; by more than 30 but
  // not more than 60 min → 12 h; by more than 60 min → 16 h.
  if      (c.excAmt === 0)  c.reqRest = 10
  else if (c.excAmt <= 0.5) c.reqRest = 11
  else if (c.excAmt <= 1)   c.reqRest = 12
  else                      c.reqRest = 16

  // Lookback, §135.267(d): at least 10 consecutive hours of rest must fall WITHIN
  // the 24 hours before the assignment's completion (release, or show as fallback).
  // Only the part of each rest inside that window counts. If the window reaches
  // back before the first logged duty, the rest there is unknown, so a missing
  // 10 hours can't be judged: N/A rather than CHECK.
  c.lookbackOk = null
  if (anchorMs !== null && dpIdx >= 0) {
    const lbStart = anchorMs - DAY
    let found = false
    for (let j = dpIdx - 1; j >= 0 && !found; j--) {
      const gapStart = periods[j].release
      const gapEnd   = periods[j + 1].show
      if (gapEnd <= lbStart) break
      found = Math.min(gapEnd, anchorMs) - Math.max(gapStart, lbStart) >= 10 * HOUR
    }
    c.lookbackOk = found ? true : lbStart < periods[0].show ? null : false
  }

  c.flightOk = c.cQualifies ? true : c.rolling24 !== null ? c.rolling24 <= c.maxFlight : null
  c.dutyOk   = c.dutyPeriod !== null ? c.dutyPeriod <= 14 : null
  c.restOk   = c.consRest !== null ? c.consRest >= c.reqRest : null

  return c
}

export interface DutyComputed {
  computedLegs: Computed[]
  allPart91: boolean
  totalFlight: number
  rolling24: number | null
  maxFlight: number
  flightOk: boolean | null
  dutyPeriod: number | null
  dutyOk: boolean | null
  reqRest: number
  lookbackOk: boolean | null
  consRest: number | null
  restOk: boolean | null
  excAmt: number
  excReason: string
  cQualifies: boolean | null
  dutyFlight: number | null
}

export function computeDutyPeriod(legs: Entry[], all: Entry[]): DutyComputed {
  const computedLegs = legs.map(l => compute(l, all))
  const p135Idx = legs.reduce<number[]>((acc, l, i) => { if (!l.part91) acc.push(i); return acc }, [])
  const allPart91 = p135Idx.length === 0
  const worstBool = (flags: (boolean | null)[]): boolean | null =>
    flags.some(f => f === false) ? false : flags.every(f => f === true) ? true : null
  const lastIdx     = computedLegs.length - 1
  const lastP135Idx = allPart91 ? lastIdx : p135Idx[p135Idx.length - 1]
  const lastC       = computedLegs[lastIdx]
  const lastP135C   = computedLegs[lastP135Idx]
  const excAmt      = allPart91 ? 0 : Math.max(...p135Idx.map(i => computedLegs[i].excAmt), 0)
  const excLegIdx   = excAmt > 0 ? p135Idx.slice().reverse().find(i => computedLegs[i].excAmt === excAmt) ?? -1 : -1
  return {
    computedLegs,
    allPart91,
    totalFlight: roundHrs(computedLegs.reduce((s, c) => s + (c.legFlight ?? 0), 0)),
    rolling24:   lastP135C?.rolling24 ?? null,
    maxFlight:   lastP135C?.maxFlight ?? 8,
    flightOk:    allPart91 ? null : p135Idx.some(i => computedLegs[i].flightOk === false) ? false : true,
    dutyPeriod:  lastC?.dutyPeriod ?? null,
    // From the last Part 135 leg: a trailing Part 91 leg carries no Part 135 results.
    dutyOk:      allPart91 ? null : lastP135C?.dutyOk ?? null,
    reqRest:     lastP135C?.reqRest ?? 10,
    lookbackOk:  allPart91 ? null : worstBool(p135Idx.map(i => computedLegs[i].lookbackOk)),
    consRest:    lastC?.consRest ?? null,
    restOk:      allPart91 ? null : worstBool(p135Idx.map(i => computedLegs[i].restOk)),
    excAmt,
    excReason:   excLegIdx >= 0 ? (legs[excLegIdx].reason || '(no reason recorded)') : '',
    cQualifies:  allPart91 ? null : lastP135C?.cQualifies ?? null,
    dutyFlight:  lastC?.dutyFlight ?? null,
  }
}

/** Part 135 flight hours of legs released within [start, end). */
export function flightHoursInWindow(entries: Entry[], start: number, end: number): number {
  return roundHrs(entries.reduce((sum, e) => {
    if (e.restDay || e.part91) return sum
    const anchor = ms(e.releaseTime) ?? ms(e.showTime)
    if (anchor === null || anchor < start || anchor >= end) return sum
    return sum + (hobbsFlightTime(parseHobbs(e.offBlocks), parseHobbs(e.onBlocks)) ?? 0)
  }, 0))
}

export function quarterFlightHours(entries: Entry[], qIdx: number, year: number, tz?: string): number {
  return flightHoursInWindow(entries, monthStartMs(year, qIdx * 3, tz), monthStartMs(year, qIdx * 3 + 3, tz))
}

export function twoQuarterFlightHours(entries: Entry[], qIdx: number, year: number, tz?: string): number {
  const prevQ    = qIdx === 0 ? 3 : qIdx - 1
  const prevYear = qIdx === 0 ? year - 1 : year
  return roundHrs(quarterFlightHours(entries, qIdx, year, tz) + quarterFlightHours(entries, prevQ, prevYear, tz))
}

export function annualFlightHours(entries: Entry[], year: number, tz?: string): number {
  return flightHoursInWindow(entries, monthStartMs(year, 0, tz), monthStartMs(year, 12, tz))
}

/** §135.267(f) rest periods (each full 24 h of rest) in a calendar quarter of the selected timezone. */
export function quarterRestCount(entries: Entry[], qIdx: number, year: number, tz?: string, now?: number): number {
  return restPeriodsInWindow(entries, monthStartMs(year, qIdx * 3, tz), monthStartMs(year, qIdx * 3 + 3, tz), now)
}

export function exportCSV(entries: Entry[]): void {
  const legs = entries.filter(e => !e.restDay)
  if (!legs.length) { alert('No data to export.'); return }

  const hdr = [
    'Show Time', 'Release Time', 'Pilot', 'Crew Config', 'Tail Number', 'Entity', 'Route',
    'Off Blocks', 'On Blocks', 'Leg Flight (h)', 'Rolling 24-hr (h)',
    'Max Allowed (h)', 'Flight Limit Basis', 'Flight Time OK', 'Duty Period (h)', 'Duty OK',
    '10-hr Lookback OK', 'Consecutive Rest (h)', 'Required Rest (h)',
    'Rest OK', 'Exceedance (h)', 'Exceedance Reason',
    'Rest Start', 'Rest End', 'Part 135',
  ].join(',')

  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const iso = (t: number) => new Date(t).toISOString().slice(0, 16) + 'Z'

  const rows = legs.map(e => {
    const c = compute(e, entries)
    // Rest runs from release to the next show (derived, not stored).
    const relMs   = ms(e.releaseTime)
    const restEnd = relMs !== null && c.consRest !== null ? iso(relMs + c.consRest * HOUR) : ''
    const basis   = e.part91 ? 'N/A' : c.cQualifies ? 'Sec. 135.267(c) duty period' : 'Sec. 135.267(b) rolling 24-hr'
    return [
      q(e.showTime), q(e.releaseTime || ''), q(e.pilot), q(e.crew === 'D' ? 'Dual' : 'Single'),
      q(e.tailNumber || ''),
      q(e.entity || ''),
      q(`${(e.dep || '').toUpperCase()}-${(e.arr || '').toUpperCase()}`),
      q(e.offBlocks), q(e.onBlocks),
      q(c.legFlight !== null ? c.legFlight.toFixed(2) : ''),
      q(c.rolling24 !== null ? c.rolling24.toFixed(2) : ''),
      q(c.maxFlight),
      q(basis),
      q(c.flightOk === null ? 'N/A' : c.flightOk ? 'OK' : 'EXCEEDED'),
      q(c.dutyPeriod !== null ? c.dutyPeriod.toFixed(2) : ''),
      q(c.dutyOk === null ? 'N/A' : c.dutyOk ? 'OK' : 'EXCEEDED'),
      q(c.lookbackOk === null ? 'N/A' : c.lookbackOk ? 'OK' : 'CHECK'),
      q(c.consRest !== null ? c.consRest.toFixed(2) : ''),
      q(c.reqRest),
      q(c.restOk === null ? 'N/A' : c.restOk ? 'OK' : 'DEFICIENT'),
      q(c.excAmt.toFixed(2)),
      q(e.reason || ''),
      q(restEnd ? e.releaseTime : ''), q(restEnd),
      q(e.part91 ? '' : 'True'),
    ].join(',')
  })

  const csv = [hdr, ...rows].join('\n')
  void saveFile(csv, `far135_log_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
}

function parseCSVRow(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let val = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { val += line[i++] }
      }
      fields.push(val)
      if (line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) { fields.push(line.slice(i)); break }
      fields.push(line.slice(i, end))
      i = end + 1
    }
  }
  return fields
}

export interface SkippedRow { line: number; reason: string }

export function importCSV(text: string): { entries: Entry[]; skipped: SkippedRow[] } | { error: string } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { error: 'File is empty or has no data rows.' }

  const headers = parseCSVRow(lines[0])
  const idx = (name: string) => headers.indexOf(name)

  const showIdx    = idx('Show Time')
  const crewIdx    = idx('Crew Config')
  if (showIdx === -1) return { error: 'Missing required column: "Show Time".' }
  if (crewIdx === -1) return { error: 'Missing required column: "Crew Config".' }

  const releaseIdx  = idx('Release Time')
  const pilotIdx    = idx('Pilot')
  const tailIdx     = idx('Tail Number')
  const entityIdx   = idx('Entity')
  const depIdx      = idx('Route')
  const offIdx      = idx('Off Blocks')
  const onIdx       = idx('On Blocks')
  const reasonIdx   = idx('Exceedance Reason')
  const restDayIdx  = idx('24-hr Rest Day')   // legacy column in older exports
  const part135Idx  = idx('Part 135')
  // Rest Start / Rest End columns are ignored: rest is derived from release
  // and the next show time.

  const get = (row: string[], i: number) => (i === -1 ? '' : (row[i] ?? ''))

  const entries: Entry[] = []
  const skipped: SkippedRow[] = []
  for (let li = 1; li < lines.length; li++) {
    const row = parseCSVRow(lines[li])
    if (row.every(c => !c.trim())) continue

    const showTime = get(row, showIdx).trim()
    if (!showTime) { skipped.push({ line: li + 1, reason: 'missing Show Time' }); continue }

    if (get(row, restDayIdx).trim() === 'Yes') { skipped.push({ line: li + 1, reason: 'rest-day row (no longer used: rest is calculated from release and show times)' }); continue }

    const routeVal  = get(row, depIdx).trim()
    const dashIdx   = routeVal.indexOf('-')
    const dep       = dashIdx !== -1 ? routeVal.slice(0, dashIdx) : routeVal
    const arr       = dashIdx !== -1 ? routeVal.slice(dashIdx + 1) : ''
    const offBlocks = get(row, offIdx).trim()
    const onBlocks  = get(row, onIdx).trim()

    if (!dep || !arr) { skipped.push({ line: li + 1, reason: 'missing departure or arrival' }); continue }
    const offN = parseHobbs(offBlocks)
    const onN  = parseHobbs(onBlocks)
    if (offN === null || onN === null) { skipped.push({ line: li + 1, reason: 'missing or unreadable Hobbs reading' }); continue }
    if (onN <= offN) { skipped.push({ line: li + 1, reason: 'On Blocks not greater than Off Blocks' }); continue }

    const part91 = get(row, part135Idx).trim() !== 'True'

    entries.push({
      id:          uid(),
      pilot:       get(row, pilotIdx).trim(),
      crew:        get(row, crewIdx).trim() === 'Dual' ? 'D' : 'S',
      tailNumber:  get(row, tailIdx).trim() || undefined,
      entity:      get(row, entityIdx).trim() || undefined,
      showTime,
      releaseTime: get(row, releaseIdx).trim() || '',
      dep,
      arr,
      offBlocks,
      onBlocks,
      restStart:   '',
      restEnd:     '',
      reason:      get(row, reasonIdx).trim(),
      part91,
      restDay:     false,
    })
  }

  if (!entries.length) return { error: 'No valid entries found in file.' }
  return { entries, skipped }
}

