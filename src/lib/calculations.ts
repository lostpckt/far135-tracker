import type { Entry, Computed } from '@/types/entry'
import { localToUtcIso, utcToLocalParts } from '@/lib/timezone'

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

export function parseDTPair(date: string, time: string): string {
  if (!date || !time) return ''
  const t = time.trim()
  const norm = t.length === 4 ? t.slice(0, 2) + ':' + t.slice(2) : t
  if (!/^\d{2}:\d{2}$/.test(norm)) return ''
  return `${date}T${norm}`
}

export function splitDT(dtStr: string): { d: string; t: string } {
  if (!dtStr) return { d: '', t: '' }
  const [d, t] = dtStr.split('T')
  return { d: d || '', t: t || '' }
}

/** Parse a Hobbs meter reading string into a float, or null if invalid. */
export function parseHobbs(val: string | undefined | null): number | null {
  if (!val) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
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
    c.excAmt     = 0
    c.reqRest    = 10
    c.lookbackOk = null
    c.flightOk   = null
    c.dutyOk     = null
    c.restOk     = null
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
        let lastDayEnd: number | null
        if (e.showTime?.endsWith('Z')) {
          // UTC storage: showTime is local midnight as UTC
          const dayStart = ms(e.showTime)
          if (dayStart === null) return false
          if (e.restDayEnd) {
            const endMs = tz
              ? ms(localToUtcIso(e.restDayEnd, '00:00', tz))
              : ms(e.restDayEnd + 'T00:00')
            lastDayEnd = (endMs ?? dayStart) + 86400000
          } else {
            lastDayEnd = dayStart + 86400000
          }
        } else {
          // Legacy no-Z: browser local time
          const lastDateStr = e.restDayEnd || (e.showTime ? e.showTime.split('T')[0] : null)
          if (!lastDateStr) return false
          const lastDayStart = ms(lastDateStr + 'T00:00')
          lastDayEnd = lastDayStart !== null ? lastDayStart + 86400000 : null
        }
        if (!lastDayEnd) return false
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

  c.flightOk = c.rolling24 !== null ? c.rolling24 <= c.maxFlight : null
  c.dutyOk   = c.dutyPeriod !== null ? c.dutyPeriod <= 14 : null
  c.restOk   = c.consRest !== null ? c.consRest >= c.reqRest : null

  return c
}

function countRestDaysInWindow(e: Entry, winStart: number, winEnd: number, tz?: string): number {
  if (!e.restDay) return 0
  let start: number
  let end: number
  if (e.showTime?.endsWith('Z')) {
    start = ms(e.showTime) ?? NaN
    const endDateStr = e.restDayEnd
    if (endDateStr) {
      const endMs = tz
        ? ms(localToUtcIso(endDateStr, '00:00', tz))
        : ms(endDateStr + 'T00:00')
      end = endMs ?? start
    } else {
      end = start
    }
  } else {
    const startStr = e.showTime ? e.showTime.split('T')[0] : ''
    if (!startStr) return 0
    const endStr = e.restDayEnd || startStr
    start = new Date(startStr + 'T00:00:00').getTime()
    end   = new Date(endStr  + 'T00:00:00').getTime()
  }
  if (isNaN(start) || isNaN(end) || end < start) return 1
  let count = 0
  for (let d = start; d <= end; d += 86400000) {
    if (d >= winStart && d < winEnd) count++
  }
  return count
}

export function quarterFlightHours(entries: Entry[], qIdx: number, year: number): number {
  const qStart = new Date(year, qIdx * 3, 1).getTime()
  const qEnd   = new Date(year, qIdx * 3 + 3, 1).getTime()
  return entries.reduce((sum, e) => {
    if (e.restDay || e.part91) return sum
    const anchor = ms(e.releaseTime) ?? ms(e.showTime)
    if (anchor === null || anchor < qStart || anchor >= qEnd) return sum
    return sum + (hobbsFlightTime(parseHobbs(e.offBlocks), parseHobbs(e.onBlocks)) ?? 0)
  }, 0)
}

export function twoQuarterFlightHours(entries: Entry[], qIdx: number, year: number): number {
  const prevQ    = qIdx === 0 ? 3 : qIdx - 1
  const prevYear = qIdx === 0 ? year - 1 : year
  return quarterFlightHours(entries, qIdx, year) + quarterFlightHours(entries, prevQ, prevYear)
}

export function annualFlightHours(entries: Entry[], year: number): number {
  const yStart = new Date(year, 0, 1).getTime()
  const yEnd   = new Date(year + 1, 0, 1).getTime()
  return entries.reduce((sum, e) => {
    if (e.restDay || e.part91) return sum
    const anchor = ms(e.releaseTime) ?? ms(e.showTime)
    if (anchor === null || anchor < yStart || anchor >= yEnd) return sum
    return sum + (hobbsFlightTime(parseHobbs(e.offBlocks), parseHobbs(e.onBlocks)) ?? 0)
  }, 0)
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
    'Show Time', 'Pilot', 'Crew Config', 'Route',
    'Off Blocks', 'On Blocks', 'Leg Flight (h)', 'Rolling 24-hr (h)',
    'Max Allowed (h)', 'Flight Time OK', 'Duty Period (h)', 'Duty OK',
    '10-hr Lookback OK', 'Consecutive Rest (h)', 'Required Rest (h)',
    'Rest OK', 'Exceedance (h)', 'Exceedance Reason', '24-hr Rest Day',
  ].join(',')

  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const rows = entries.map(e => {
    if (e.restDay) {
      return [q(e.showTime), q(e.pilot), q(e.crew === 'D' ? 'Dual' : 'Single'),
        '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', q('Yes')].join(',')
    }
    const c = compute(e, entries, tz)
    return [
      q(e.showTime), q(e.pilot), q(e.crew === 'D' ? 'Dual' : 'Single'),
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
      q('No'),
    ].join(',')
  })

  const csv  = [hdr, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `far135_log_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

export function generateQuarterlyReport(entries: Entry[], qIdx: number, year: number, tz?: string, dark = false): string {
  const qStart = new Date(year, qIdx * 3, 1).getTime()
  const qEnd   = new Date(year, qIdx * 3 + 3, 1).getTime()
  const qLabel = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'][qIdx]

  const qEntries = entries.filter(e => {
    const anchor = ms(e.releaseTime) ?? ms(e.showTime)
    return anchor !== null && anchor >= qStart && anchor < qEnd
  })

  if (!qEntries.length) return ''

  const flightLegs  = qEntries.filter(e => !e.restDay)
  const part135Legs = flightLegs.filter(e => !e.part91)
  const part91Legs  = flightLegs.filter(e => e.part91)
  const restDays    = qEntries.reduce((sum, e) => sum + countRestDaysInWindow(e, qStart, qEnd, tz), 0)

  let totalFlight   = 0
  let part135Flight = 0
  const violations: { date: string; pilot: string; type: string; detail: string }[] = []
  const exceedances: { date: string; pilot: string; route: string; over: string; reason: string; reqRest: number }[] = []
  let flightFailCount = 0, dutyFailCount = 0, restFailCount = 0

  flightLegs.forEach(e => {
    const c = compute(e, entries, tz)
    totalFlight += c.legFlight || 0
    if (!e.part91) part135Flight += c.legFlight || 0
    if (e.part91) return

    if (c.flightOk === false) {
      flightFailCount++
      violations.push({ date: fmtDT(e.releaseTime || e.showTime), pilot: e.pilot, type: 'Flight Time Exceeded', detail: `Rolling 24-hr: ${fmtHrs(c.rolling24)} (limit ${c.maxFlight}h)` })
    }
    if (c.dutyOk === false) {
      dutyFailCount++
      violations.push({ date: fmtDT(e.showTime), pilot: e.pilot, type: 'Duty Period Exceeded', detail: `Duty: ${fmtHrs(c.dutyPeriod)} (limit 14h)` })
    }
    if (c.restOk === false) {
      restFailCount++
      violations.push({ date: fmtDT(e.restStart), pilot: e.pilot, type: 'Rest Deficient', detail: `Got ${fmtHrs(c.consRest)}, required ${c.reqRest}h` })
    }
    if (c.excAmt > 0)
      exceedances.push({ date: fmtDT(e.releaseTime || e.showTime), pilot: e.pilot, route: `${(e.dep || '?').toUpperCase()}→${(e.arr || '?').toUpperCase()}`, over: fmtHrs(c.excAmt), reason: e.reason || '—', reqRest: c.reqRest })
  })

  const totalViolations = flightFailCount + dutyFailCount + restFailCount
  const restMet   = restDays >= 13
  const overallOk = totalViolations === 0 && restMet

  // Color palette — adapts to dark / light mode
  const col = dark ? {
    bg: '#0f172a', fg: '#e2e8f0', muted: '#94a3b8', border: '#334155',
    surface: '#1e293b', blue: '#60a5fa',
    greenBg: '#052e16', green: '#4ade80',
    redBg:   '#450a0a', red:   '#f87171',
    amberBg: '#431407', amber: '#fbbf24',
    rowBorder: '#1e293b', printBtn: '#334155',
  } : {
    bg: '#ffffff', fg: '#1a1a2e', muted: '#666', border: '#e5e7eb',
    surface: '#f8fafc', blue: '#2563eb',
    greenBg: '#f0fdf4', green: '#16a34a',
    redBg:   '#fef2f2', red:   '#dc2626',
    amberBg: '#fffef0', amber: '#92400e',
    rowBorder: '#f1f5f9', printBtn: '#1a1a2e',
  }

  const statusColor = overallOk ? col.green : col.red
  const statusText  = overallOk ? 'COMPLIANT' : 'REVIEW REQUIRED'

  const flag = (v: boolean | null) => v === null ? '—' : v ? '✓' : '⚠'

  const qFlightOk = part135Flight < 500
  const scRows = [
    ['Rolling 24-hr Flight Time',          flightFailCount === 0 ? 'PASS' : `${flightFailCount} VIOLATION(S)`, flightFailCount === 0],
    ['14-Hour Duty Day Limit',             dutyFailCount   === 0 ? 'PASS' : `${dutyFailCount} VIOLATION(S)`,   dutyFailCount   === 0],
    ['Rest Requirements',                  restFailCount   === 0 ? 'PASS' : `${restFailCount} DEFICIENCY(IES)`, restFailCount  === 0],
    ['10-hr Look-Back Rest',               'See detail rows below', null],
    ['24-hr Rest Days (≥13/qtr)',          `${restDays} of 13 required`, restMet],
    ['Quarterly Flight Hours §135.267(a)', qFlightOk ? `${fmtHrs(part135Flight)} of 500h — OK` : `${fmtHrs(part135Flight)} — EXCEEDED`, qFlightOk],
  ].map(([req, result, ok]) => {
    const rowBg  = ok === null ? col.surface : ok ? col.greenBg : col.redBg
    const rowCol = ok === null ? col.muted   : ok ? col.green   : col.red
    return `<tr style="background:${rowBg}"><td style="padding:8px 12px;border-bottom:1px solid ${col.border}">${req}</td><td style="padding:8px 12px;border-bottom:1px solid ${col.border};font-weight:700;color:${rowCol}">${result}</td></tr>`
  }).join('')

  const vRows = violations.length
    ? violations.map(v => `<tr><td>${v.date}</td><td>${v.pilot || '—'}</td><td style="color:${col.red};font-weight:600">${v.type}</td><td>${v.detail}</td></tr>`).join('')
    : `<tr><td colspan="4" style="color:${col.green};padding:10px">No violations recorded this quarter.</td></tr>`

  const exRows = exceedances.length
    ? exceedances.map(x => `<tr><td>${x.date}</td><td>${x.pilot || '—'}</td><td>${x.route}</td><td style="color:${col.red};font-weight:600">${x.over}</td><td>${x.reason}</td><td>${x.reqRest}h</td></tr>`).join('')
    : `<tr><td colspan="6" style="color:${col.green};padding:10px">No exceedances this quarter.</td></tr>`

  const sorted = [...qEntries].sort((a, b) => (ms(a.showTime) ?? 0) - (ms(b.showTime) ?? 0))

  // Helper: local calendar date string for an entry
  function entryLocalDate(e: Entry): string {
    if (!e.showTime) return ''
    if (e.showTime.endsWith('Z') && tz) return utcToLocalParts(e.showTime, tz)?.date ?? e.showTime.slice(0, 10)
    return e.showTime.split('T')[0] ?? ''
  }

  // Aggregate per-day totals for the summary view
  type DaySummary = { p135: number; p91: number; pilots: Set<string>; hasViolation: boolean }
  const dayMap = new Map<string, DaySummary>()
  for (const e of qEntries) {
    if (e.restDay) continue
    const dk = entryLocalDate(e)
    if (!dk) continue
    if (!dayMap.has(dk)) dayMap.set(dk, { p135: 0, p91: 0, pilots: new Set(), hasViolation: false })
    const d = dayMap.get(dk)!
    if (e.pilot) d.pilots.add(e.pilot)
    const ft = hobbsFlightTime(parseHobbs(e.offBlocks), parseHobbs(e.onBlocks)) ?? 0
    if (e.part91) {
      d.p91 += ft
    } else {
      d.p135 += ft
      const c = compute(e, entries, tz)
      if (c.flightOk === false || c.dutyOk === false || c.restOk === false) d.hasViolation = true
    }
  }

  // Daily summary rows — one row per calendar day for flight days, one per rest entry
  const seenDates = new Set<string>()
  const summaryRows = sorted.map(e => {
    if (e.restDay) {
      const startStr = e.showTime?.endsWith('Z') && tz
        ? (utcToLocalParts(e.showTime, tz)?.date ?? e.showTime.slice(0, 10))
        : (e.showTime ? e.showTime.split('T')[0] : '')
      const endStr  = e.restDayEnd || startStr
      const days    = countRestDaysInWindow(e, qStart, qEnd, tz)
      const dateLabel = endStr && endStr !== startStr ? `${startStr} – ${endStr}` : startStr
      const daysLabel = days > 1 ? ` (${days} days)` : ''
      return `<tr style="background:${col.greenBg}"><td>${dateLabel}</td><td colspan="3" style="color:${col.green};font-weight:700">● REST DAY${days > 1 ? 'S' : ''}${daysLabel}</td></tr>`
    }
    const dk = entryLocalDate(e)
    if (!dk || seenDates.has(dk)) return ''
    seenDates.add(dk)
    const d = dayMap.get(dk)
    if (!d) return ''
    const pilotsStr = [...d.pilots].join(', ') || '—'
    const rowBg = d.hasViolation ? `background:${col.redBg}` : ''
    return `<tr${rowBg ? ` style="${rowBg}"` : ''}><td>${dk}</td><td>${pilotsStr}</td><td>${d.p135 > 0 ? fmtHrs(d.p135) : '—'}</td><td style="color:${d.p91 > 0 ? col.amber : col.muted}">${d.p91 > 0 ? fmtHrs(d.p91) : '—'}</td></tr>`
  }).filter(Boolean).join('')

  // Full per-leg log rows
  const logRows = sorted.map(e => {
    if (e.restDay) {
      const startStr = e.showTime?.endsWith('Z') && tz
        ? (utcToLocalParts(e.showTime, tz)?.date ?? e.showTime.slice(0, 10))
        : (e.showTime ? e.showTime.split('T')[0] : '')
      const endStr = e.restDayEnd || startStr
      const days   = countRestDaysInWindow(e, qStart, qEnd, tz)
      const label  = endStr && endStr !== startStr
        ? `● 24-HOUR REST DAYS: ${startStr} – ${endStr} (${days} days)`
        : `● 24-HOUR REST DAY`
      return `<tr style="background:${col.greenBg}"><td>${fmtDT(e.showTime)}</td><td>${e.pilot || '—'}</td><td colspan="12" style="color:${col.green};font-weight:600">${label}</td></tr>`
    }
    const c = compute(e, entries, tz)
    if (e.part91) return `<tr style="background:${col.amberBg}"><td>${fmtDT(e.showTime)}</td><td>${e.pilot || '—'}</td><td>${e.crew === 'D' ? 'Dual' : 'Single'}</td><td>${(e.dep || '—').toUpperCase()}→${(e.arr || '—').toUpperCase()}</td><td>${e.offBlocks || '—'}</td><td>${e.onBlocks || '—'}</td><td>${fmtHrs(c.legFlight)}</td><td colspan="7" style="color:${col.amber};font-weight:600">▶ Part 91 — Excluded from §135.267 limits</td></tr>`
    return `<tr><td>${fmtDT(e.showTime)}</td><td>${e.pilot || '—'}</td><td>${e.crew === 'D' ? 'Dual' : 'Single'}</td><td>${(e.dep || '—').toUpperCase()}→${(e.arr || '—').toUpperCase()}</td><td>${e.offBlocks || '—'}</td><td>${e.onBlocks || '—'}</td><td>${fmtHrs(c.legFlight)}</td><td style="color:${c.flightOk===false?col.red:'inherit'}">${c.rolling24!==null?fmtHrs(c.rolling24):'—'} / ${c.maxFlight}h</td><td>${flag(c.flightOk)}</td><td style="color:${c.dutyOk===false?col.red:'inherit'}">${fmtHrs(c.dutyPeriod)}</td><td>${flag(c.dutyOk)}</td><td style="color:${c.restOk===false?col.red:'inherit'}">${fmtHrs(c.consRest)} / ${c.reqRest}h</td><td>${flag(c.restOk)}</td><td>${c.excAmt > 0 ? fmtHrs(c.excAmt) : '—'}</td></tr>`
  }).join('')

  const pilots    = [...new Set(flightLegs.map(e => e.pilot).filter(Boolean))].join(', ') || 'All Pilots'
  const generated = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<title>FAR 135.267 Quarterly Report — ${qLabel} ${year}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${col.bg}; color: ${col.fg}; padding: 32px; font-size: 13px; }
h1 { font-size: 1.3rem; margin-bottom: 4px; }
h2 { font-size: 0.95rem; margin: 24px 0 8px; border-bottom: 2px solid ${col.border}; padding-bottom: 5px; }
.meta { color: ${col.muted}; font-size: 0.8rem; margin-bottom: 20px; }
.status-banner { background: ${overallOk ? col.greenBg : col.redBg}; border: 2px solid ${statusColor}; border-radius: 8px; padding: 12px 18px; color: ${statusColor}; font-weight: 700; font-size: 1rem; margin-bottom: 20px; }
.stat-box { background: ${col.surface}; border-radius: 7px; padding: 12px 16px; display:inline-block; margin: 0 8px 8px 0; min-width:140px; }
.stat-box .val { font-size: 1.5rem; font-weight: 700; color: ${col.blue}; }
.stat-box .lbl { font-size: 0.75rem; color: ${col.muted}; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 8px; }
th { background: ${col.surface}; padding: 7px 10px; text-align: left; font-weight: 700; color: ${col.muted}; border-bottom: 2px solid ${col.border}; white-space: nowrap; }
td { padding: 7px 10px; border-bottom: 1px solid ${col.rowBorder}; vertical-align: middle; white-space: nowrap; }
.disclaimer { margin-top: 28px; font-size: 0.72rem; color: ${col.muted}; border-top: 1px solid ${col.border}; padding-top: 10px; }
.btn { margin-bottom: 12px; padding: 8px 20px; background: ${col.printBtn}; color: ${dark ? col.fg : 'white'}; border: none; border-radius: 7px; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
.btn-sec { background: #6b7280; color: white; margin-left: 8px; }
.btn-tog { background: ${col.surface}; color: ${col.fg}; border: 1px solid ${col.border}; margin-left: 8px; }
@media print { .no-print { display: none; } body { padding: 16px; } }
</style>
<script>
function toggleLog() {
  var s = document.getElementById('summaryLog');
  var f = document.getElementById('fullLog');
  var b = document.getElementById('toggleBtn');
  var showingFull = f.style.display !== 'none';
  f.style.display = showingFull ? 'none' : '';
  s.style.display = showingFull ? '' : 'none';
  b.textContent = showingFull ? 'Show Full Log' : 'Show Summary';
}
</script>
</head><body>
<div class="no-print" style="margin-bottom:20px">
  <button class="btn" onclick="window.print()">Print / Save as PDF</button>
  <button class="btn btn-sec" onclick="window.close()">✕ Close</button>
  <button class="btn btn-tog" id="toggleBtn" onclick="toggleLog()">Show Full Log</button>
</div>
<h1>FAR 135.267 Quarterly Compliance Report</h1>
<div class="meta">Period: <strong>${qLabel} ${year}</strong> &nbsp;|&nbsp; Pilot(s): <strong>${pilots}</strong> &nbsp;|&nbsp; Generated: ${generated}</div>
<div class="status-banner">${overallOk ? '✓' : '⚠'} Overall Status: ${statusText}${!overallOk ? ` — ${totalViolations} violation(s) and/or rest day shortfall detected` : ''}</div>
<div style="margin-bottom:20px">
  <div class="stat-box"><div class="val">${part135Legs.length}</div><div class="lbl">Part 135 Legs${part91Legs.length ? `<br><span style="color:${col.amber}">(+${part91Legs.length} Part 91)</span>` : ''}</div></div>
  <div class="stat-box"><div class="val">${fmtHrs(totalFlight)}</div><div class="lbl">Total Flight Time</div></div>
  <div class="stat-box"><div class="val" style="color:${restMet?col.green:col.red}">${restDays} / 13</div><div class="lbl">24-hr Rest Days</div></div>
  <div class="stat-box"><div class="val" style="color:${totalViolations===0?col.green:col.red}">${totalViolations}</div><div class="lbl">Total Violations</div></div>
</div>
<h2>Scorecard</h2><table><thead><tr><th>Requirement</th><th>Result</th></tr></thead><tbody>${scRows}</tbody></table>
<h2>Violations Detail</h2><table><thead><tr><th>Date</th><th>Pilot</th><th>Type</th><th>Detail</th></tr></thead><tbody>${vRows}</tbody></table>
<h2>Exceedances</h2><table><thead><tr><th>Date</th><th>Pilot</th><th>Route</th><th>Over Limit</th><th>Reason</th><th>Req Rest</th></tr></thead><tbody>${exRows}</tbody></table>
<h2>Flight Log</h2>
<div id="summaryLog">
<table><thead><tr><th>Date</th><th>Pilot(s)</th><th>Part 135 Time</th><th>Part 91 Time</th></tr></thead><tbody>${summaryRows}</tbody></table>
</div>
<div id="fullLog" style="display:none">
<table><thead><tr><th>Show Time</th><th>Pilot</th><th>Crew</th><th>Route</th><th>Off Blocks</th><th>On Blocks</th><th>Leg Time</th><th>Rolling 24-hr</th><th>Flt✓</th><th>Duty</th><th>Duty✓</th><th>Rest After</th><th>Rest✓</th><th>Exc</th></tr></thead><tbody>${logRows}</tbody></table>
</div>
<div class="disclaimer">This report is for reference and record-keeping only. Always verify compliance with your OpSpec, POI, and company manual. Generated by FAR 135.267 Duty &amp; Flight Time Tracker.</div>
</body></html>`
}
