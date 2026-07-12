import type { Entry, Computed } from '@/types/entry'
import { localToUtcIso } from '@/lib/timezone'

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
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
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

// Returns false if restStart is before releaseTime, or if restEnd extends past
// the next duty period's showTime. Entries with no rest times always return true.
export function checkRestOverlapForEntry(entry: Entry, all: Entry[]): boolean {
  if (entry.restDay || entry.part91) return true
  const anchor = ms(entry.releaseTime) ?? ms(entry.showTime)
  const rsMs   = ms(entry.restStart)
  const reMs   = ms(entry.restEnd)
  if (rsMs === null && reMs === null) return true
  if (rsMs !== null && anchor !== null && rsMs < anchor) return false
  if (reMs !== null && anchor !== null) {
    for (const e of all) {
      if (e.restDay || e.part91 || e.id === entry.id) continue
      const eShowMs = ms(e.showTime)
      if (eShowMs !== null && eShowMs > anchor) {
        if (reMs > eShowMs) return false
        break
      }
    }
  }
  return true
}

/** Flight time from Hobbs readings: onHobbs - offHobbs. */
export function hobbsFlightTime(offHobbs: number | null, onHobbs: number | null): number | null {
  if (offHobbs === null || onHobbs === null) return null
  const diff = onHobbs - offHobbs
  if (diff < 0) return null
  return diff
}

export function compute(entry: Entry, all: Entry[], tz?: string): Computed {
  const c = {} as Computed

  const offHobbs = parseHobbs(entry.offBlocks)
  const onHobbs  = parseHobbs(entry.onBlocks)
  const showMs   = ms(entry.showTime)
  const relMs    = ms(entry.releaseTime)
  const rsMs     = ms(entry.restStart)
  const reMs     = ms(entry.restEnd)

  // Flight time from Hobbs; duty/rest from datetime fields
  c.legFlight  = hobbsFlightTime(offHobbs, onHobbs)
  c.dutyPeriod = hrs(showMs, relMs)
  c.consRest   = hrs(rsMs, reMs)
  c.maxFlight  = entry.crew === 'D' ? 10 : 8

  // Rolling 24-hr window anchored to releaseTime (or showTime fallback) since Hobbs has no timestamp.
  // Computed before the Part 91 check so the dashboard reflects accumulated Part 135 hours
  // even when the most recent leg is a Part 91 repositioning flight.
  const anchorMs = relMs ?? showMs
  if (anchorMs !== null) {
    const windowStart = anchorMs - 86400000
    c.rolling24 = all.reduce((sum, e) => {
      if (e.part91) return sum
      const eAnchor = ms(e.releaseTime) ?? ms(e.showTime)
      const eOff    = parseHobbs(e.offBlocks)
      const eOn     = parseHobbs(e.onBlocks)
      if (eAnchor === null || eOff === null || eOn === null) return sum
      if (eAnchor <= anchorMs && eAnchor > windowStart)
        return sum + hobbsFlightTime(eOff, eOn)!
      return sum
    }, 0)
  } else {
    c.rolling24 = null
  }

  if (entry.part91) {
    c.excAmt        = 0
    c.reqRest       = 10
    c.lookbackOk    = null
    c.flightOk      = null
    c.dutyOk        = null
    c.restOk        = null
    c.restOverlapOk = null
    return c
  }

  c.excAmt = c.rolling24 !== null ? Math.max(0, c.rolling24 - c.maxFlight) : 0

  if      (c.excAmt === 0) c.reqRest = 10
  else if (c.excAmt < 0.5) c.reqRest = 11
  else if (c.excAmt <= 1)  c.reqRest = 12
  else                     c.reqRest = 16

  // Lookback: anchor to releaseTime/showTime
  c.lookbackOk = null
  if (anchorMs !== null) {
    const lbStart = anchorMs - 86400000
    const found = all.some(e => {
      if (e.id === entry.id) return false
      if (e.restDay) {
        const dayStart = ms(e.showTime)
        if (dayStart === null) return false
        const endMs = e.restDayEnd
          ? (tz ? ms(localToUtcIso(e.restDayEnd, '00:00', tz)) : ms(e.restDayEnd + 'T00:00'))
          : null
        const lastDayEnd = (endMs ?? dayStart) + 86400000
        return lastDayEnd >= lbStart && lastDayEnd <= anchorMs
      }
      const eRe = ms(e.restEnd)
      const eRs = ms(e.restStart)
      if (eRe === null || eRs === null) return false
      const restHrs = (eRe - eRs) / 3600000
      return eRe >= lbStart && eRe <= anchorMs && restHrs >= 10
    })
    const hasPrior = all.some(e =>
      e.id !== entry.id && (ms(e.restEnd) !== null || e.restDay)
    )
    c.lookbackOk = hasPrior ? found : null
  }

  c.flightOk      = c.rolling24 !== null ? c.rolling24 <= c.maxFlight : null
  c.dutyOk        = c.dutyPeriod !== null ? c.dutyPeriod <= 14 : null
  c.restOk        = c.consRest !== null ? c.consRest >= c.reqRest : null
  c.restOverlapOk = (rsMs !== null || reMs !== null) ? checkRestOverlapForEntry(entry, all) : null

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
  restOverlapOk: boolean | null
}

export function computeDutyPeriod(legs: Entry[], all: Entry[], tz?: string): DutyComputed {
  const computedLegs = legs.map(l => compute(l, all, tz))
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
    totalFlight: computedLegs.reduce((s, c) => s + (c.legFlight ?? 0), 0),
    rolling24:   lastP135C?.rolling24 ?? null,
    maxFlight:   lastP135C?.maxFlight ?? 8,
    flightOk:    allPart91 ? null : p135Idx.some(i => computedLegs[i].flightOk === false) ? false : true,
    dutyPeriod:  lastC?.dutyPeriod ?? null,
    dutyOk:      allPart91 ? null : lastC?.dutyOk ?? null,
    reqRest:     lastP135C?.reqRest ?? 10,
    lookbackOk:  allPart91 ? null : worstBool(p135Idx.map(i => computedLegs[i].lookbackOk)),
    consRest:    lastC?.consRest ?? null,
    restOk:      allPart91 ? null : worstBool(p135Idx.map(i => computedLegs[i].restOk)),
    excAmt,
    excReason:    excLegIdx >= 0 ? (legs[excLegIdx].reason || '(no reason recorded)') : '',
    restOverlapOk: lastC?.restOverlapOk ?? null,
  }
}

export function countRestDaysInWindow(e: Entry, winStart: number, winEnd: number, tz?: string): number {
  if (!e.restDay) return 0
  const start = ms(e.showTime) ?? NaN
  if (isNaN(start)) return 0
  const endMs = e.restDayEnd
    ? (tz ? ms(localToUtcIso(e.restDayEnd, '00:00', tz)) : ms(e.restDayEnd + 'T00:00'))
    : null
  const end = endMs ?? start
  if (isNaN(end) || end < start) return 1
  let count = 0
  for (let d = start; d <= end; d += 86400000) {
    if (d >= winStart && d < winEnd) count++
  }
  return count
}

function flightHoursInWindow(entries: Entry[], start: number, end: number): number {
  return entries.reduce((sum, e) => {
    if (e.restDay || e.part91) return sum
    const anchor = ms(e.releaseTime) ?? ms(e.showTime)
    if (anchor === null || anchor < start || anchor >= end) return sum
    return sum + (hobbsFlightTime(parseHobbs(e.offBlocks), parseHobbs(e.onBlocks)) ?? 0)
  }, 0)
}

export function quarterFlightHours(entries: Entry[], qIdx: number, year: number): number {
  return flightHoursInWindow(entries, new Date(year, qIdx * 3, 1).getTime(), new Date(year, qIdx * 3 + 3, 1).getTime())
}

export function twoQuarterFlightHours(entries: Entry[], qIdx: number, year: number): number {
  const prevQ    = qIdx === 0 ? 3 : qIdx - 1
  const prevYear = qIdx === 0 ? year - 1 : year
  return quarterFlightHours(entries, qIdx, year) + quarterFlightHours(entries, prevQ, prevYear)
}

export function annualFlightHours(entries: Entry[], year: number): number {
  return flightHoursInWindow(entries, new Date(year, 0, 1).getTime(), new Date(year + 1, 0, 1).getTime())
}

export function quarterRestCount(entries: Entry[], tz?: string): number {
  const now    = new Date()
  const qMonth = Math.floor(now.getMonth() / 3) * 3
  const qStart = new Date(now.getFullYear(), qMonth, 1).getTime()
  const qEnd   = new Date(now.getFullYear(), qMonth + 3, 1).getTime()
  return entries.reduce((sum, e) => sum + countRestDaysInWindow(e, qStart, qEnd, tz), 0)
}

export function exportCSV(entries: Entry[], tz?: string): void {
  if (!entries.length) { alert('No data to export.'); return }

  const hdr = [
    'Show Time', 'Release Time', 'Pilot', 'Crew Config', 'Tail Number', 'Entity', 'Route',
    'Off Blocks', 'On Blocks', 'Leg Flight (h)', 'Rolling 24-hr (h)',
    'Max Allowed (h)', 'Flight Time OK', 'Duty Period (h)', 'Duty OK',
    '10-hr Lookback OK', 'Consecutive Rest (h)', 'Required Rest (h)',
    'Rest OK', 'Exceedance (h)', 'Exceedance Reason',
    'Rest Start', 'Rest End', '24-hr Rest Day', 'Rest Day End', 'Part 135',
  ].join(',')

  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const rows = entries.map(e => {
    if (e.restDay) {
      return [
        q(e.showTime), q(''), q(e.pilot), q(e.crew === 'D' ? 'Dual' : 'Single'), q(''), q(''),
        q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''), q(''),
        q(''), q(''), q('Yes'), q(e.restDayEnd || ''), q(''),
      ].join(',')
    }
    const c = compute(e, entries, tz)
    return [
      q(e.showTime), q(e.releaseTime || ''), q(e.pilot), q(e.crew === 'D' ? 'Dual' : 'Single'),
      q(e.tailNumber || ''),
      q(e.entity || ''),
      q(`${(e.dep || '').toUpperCase()}-${(e.arr || '').toUpperCase()}`),
      q(e.offBlocks), q(e.onBlocks),
      q(c.legFlight !== null ? c.legFlight.toFixed(2) : ''),
      q(c.rolling24 !== null ? c.rolling24.toFixed(2) : ''),
      q(c.maxFlight),
      q(c.flightOk === null ? 'N/A' : c.flightOk ? 'OK' : 'EXCEEDED'),
      q(c.dutyPeriod !== null ? c.dutyPeriod.toFixed(2) : ''),
      q(c.dutyOk === null ? 'N/A' : c.dutyOk ? 'OK' : 'EXCEEDED'),
      q(c.lookbackOk === null ? 'N/A' : c.lookbackOk ? 'OK' : 'CHECK'),
      q(c.consRest !== null ? c.consRest.toFixed(2) : ''),
      q(c.reqRest),
      q(c.restOk === null ? 'N/A' : c.restOk ? 'OK' : 'DEFICIENT'),
      q(c.excAmt.toFixed(2)),
      q(e.reason || ''),
      q(e.restStart || ''), q(e.restEnd || ''),
      q('No'), q(''), q(e.part91 ? '' : 'True'),
    ].join(',')
  })

  const csv  = [hdr, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `far135_log_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
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

export function importCSV(text: string): Entry[] | { error: string } {
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
  const restStartIdx = idx('Rest Start')
  const restEndIdx  = idx('Rest End')
  const restDayIdx  = idx('24-hr Rest Day')
  const restDayEndIdx = idx('Rest Day End')
  const part135Idx  = idx('Part 135')

  const get = (row: string[], i: number) => (i === -1 ? '' : (row[i] ?? ''))

  const entries: Entry[] = []
  for (let li = 1; li < lines.length; li++) {
    const row = parseCSVRow(lines[li])
    if (row.every(c => !c.trim())) continue

    const showTime = get(row, showIdx).trim()
    if (!showTime) continue

    const isRestDay = get(row, restDayIdx).trim() === 'Yes'
    const routeVal  = get(row, depIdx).trim()
    const dashIdx   = routeVal.indexOf('-')
    const dep       = dashIdx !== -1 ? routeVal.slice(0, dashIdx) : routeVal
    const arr       = dashIdx !== -1 ? routeVal.slice(dashIdx + 1) : ''
    const offBlocks = get(row, offIdx).trim()
    const onBlocks  = get(row, onIdx).trim()

    if (!isRestDay) {
      if (!dep || !arr) continue
      const offN = parseHobbs(offBlocks)
      const onN  = parseHobbs(onBlocks)
      if (offN === null || onN === null || onN <= offN) continue
    }

    const part91 = isRestDay
      ? false
      : get(row, part135Idx).trim() !== 'True'

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
      restStart:   get(row, restStartIdx).trim(),
      restEnd:     get(row, restEndIdx).trim(),
      reason:      get(row, reasonIdx).trim(),
      part91,
      restDay:     isRestDay,
      restDayEnd:  get(row, restDayEndIdx).trim() || undefined,
    })
  }

  if (!entries.length) return { error: 'No valid entries found in file.' }
  return entries
}

