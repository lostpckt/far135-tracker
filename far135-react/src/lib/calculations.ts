import type { Entry, Computed } from '@/types/entry'

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
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mo}/${dy} ${hh}:${mi}`
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

export function compute(entry: Entry, all: Entry[]): Computed {
  const c = {} as Computed

  const offMs  = ms(entry.offBlocks)
  const onMs   = ms(entry.onBlocks)
  const showMs = ms(entry.showTime)
  const relMs  = ms(entry.releaseTime)
  const rsMs   = ms(entry.restStart)
  const reMs   = ms(entry.restEnd)

  c.legFlight  = hrs(offMs, onMs)
  c.dutyPeriod = hrs(showMs, relMs)
  c.consRest   = hrs(rsMs, reMs)
  c.maxFlight  = entry.crew === 'D' ? 10 : 8

  if (entry.part91) {
    c.rolling24  = null
    c.excAmt     = 0
    c.reqRest    = 10
    c.lookbackOk = null
    c.flightOk   = null
    c.dutyOk     = null
    c.restOk     = null
    return c
  }

  if (onMs !== null) {
    const windowStart = onMs - 86400000
    c.rolling24 = all.reduce((sum, e) => {
      if (e.part91) return sum
      const eOn  = ms(e.onBlocks)
      const eOff = ms(e.offBlocks)
      if (eOn === null || eOff === null) return sum
      if (eOn <= onMs && eOn > windowStart && eOn >= eOff)
        return sum + (eOn - eOff) / 3600000
      return sum
    }, 0)
  } else {
    c.rolling24 = null
  }

  c.excAmt = c.rolling24 !== null ? Math.max(0, c.rolling24 - c.maxFlight) : 0

  if      (c.excAmt === 0) c.reqRest = 10
  else if (c.excAmt < 0.5) c.reqRest = 11
  else if (c.excAmt <= 1)  c.reqRest = 12
  else                     c.reqRest = 16

  c.lookbackOk = null
  if (onMs !== null) {
    const lbStart = onMs - 86400000
    const found = all.some(e => {
      if (e.id === entry.id) return false
      if (e.restDay) {
        const dayStart = ms(e.showTime)
        const dayEnd   = dayStart ? dayStart + 86400000 : null
        if (!dayEnd) return false
        return dayEnd >= lbStart && dayEnd <= onMs
      }
      const eRe = ms(e.restEnd)
      const eRs = ms(e.restStart)
      if (eRe === null || eRs === null) return false
      const restHrs = (eRe - eRs) / 3600000
      return eRe >= lbStart && eRe <= onMs && restHrs >= 10
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

export function quarterRestCount(entries: Entry[]): number {
  const now    = new Date()
  const qMonth = Math.floor(now.getMonth() / 3) * 3
  const qStart = new Date(now.getFullYear(), qMonth, 1).getTime()
  const qEnd   = new Date(now.getFullYear(), qMonth + 3, 1).getTime()
  return entries.filter(e => {
    if (!e.restDay) return false
    const anchor = ms(e.showTime) ?? ms(e.offBlocks)
    return anchor !== null && anchor >= qStart && anchor < qEnd
  }).length
}

export function exportCSV(entries: Entry[]): void {
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
    const c = compute(e, entries)
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

export function generateQuarterlyReport(entries: Entry[], qIdx: number, year: number): string {
  const qStart = new Date(year, qIdx * 3, 1).getTime()
  const qEnd   = new Date(year, qIdx * 3 + 3, 1).getTime()
  const qLabel = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'][qIdx]

  const qEntries = entries.filter(e => {
    const anchor = ms(e.onBlocks) ?? ms(e.showTime)
    return anchor !== null && anchor >= qStart && anchor < qEnd
  })

  if (!qEntries.length) return ''

  const flightLegs  = qEntries.filter(e => !e.restDay)
  const part135Legs = flightLegs.filter(e => !e.part91)
  const part91Legs  = flightLegs.filter(e => e.part91)
  const restDays    = qEntries.filter(e => e.restDay).length

  let totalFlight   = 0
  const violations: { date: string; pilot: string; type: string; detail: string }[] = []
  const exceedances: { date: string; pilot: string; route: string; over: string; reason: string; reqRest: number }[] = []
  let flightFailCount = 0, dutyFailCount = 0, restFailCount = 0
  let flightOkCount = 0, dutyOkCount = 0, restOkCount = 0

  flightLegs.forEach(e => {
    const c = compute(e, entries)
    totalFlight += c.legFlight || 0
    if (e.part91) return

    if (c.flightOk === false) {
      flightFailCount++
      violations.push({ date: fmtDT(e.onBlocks), pilot: e.pilot, type: 'Flight Time Exceeded', detail: `Rolling 24-hr: ${fmtHrs(c.rolling24)} (limit ${c.maxFlight}h)` })
    } else if (c.flightOk === true) flightOkCount++

    if (c.dutyOk === false) {
      dutyFailCount++
      violations.push({ date: fmtDT(e.showTime), pilot: e.pilot, type: 'Duty Period Exceeded', detail: `Duty: ${fmtHrs(c.dutyPeriod)} (limit 14h)` })
    } else if (c.dutyOk === true) dutyOkCount++

    if (c.restOk === false) {
      restFailCount++
      violations.push({ date: fmtDT(e.restStart), pilot: e.pilot, type: 'Rest Deficient', detail: `Got ${fmtHrs(c.consRest)}, required ${c.reqRest}h` })
    } else if (c.restOk === true) restOkCount++

    if (c.excAmt > 0)
      exceedances.push({ date: fmtDT(e.onBlocks), pilot: e.pilot, route: `${(e.dep || '?').toUpperCase()}→${(e.arr || '?').toUpperCase()}`, over: fmtHrs(c.excAmt), reason: e.reason || '—', reqRest: c.reqRest })
  })

  // suppress unused var warnings
  void flightOkCount; void dutyOkCount; void restOkCount

  const totalViolations = flightFailCount + dutyFailCount + restFailCount
  const restMet  = restDays >= 13
  const overallOk = totalViolations === 0 && restMet
  const statusColor = overallOk ? '#16a34a' : '#dc2626'
  const statusText  = overallOk ? 'COMPLIANT' : 'REVIEW REQUIRED'

  const flag = (c: boolean | null) => c === null ? '—' : c ? '✓' : '⚠'

  const scRows = [
    ['Rolling 24-hr Flight Time', flightFailCount === 0 ? 'PASS' : `${flightFailCount} VIOLATION(S)`, flightFailCount === 0],
    ['14-Hour Duty Day Limit',    dutyFailCount   === 0 ? 'PASS' : `${dutyFailCount} VIOLATION(S)`,   dutyFailCount   === 0],
    ['Rest Requirements',         restFailCount   === 0 ? 'PASS' : `${restFailCount} DEFICIENCY(IES)`, restFailCount  === 0],
    ['10-hr Look-Back Rest',      'See detail rows below', null],
    ['24-hr Rest Days (≥13/qtr)', `${restDays} of 13 required`, restMet],
  ].map(([req, result, ok]) => {
    const bg  = ok === null ? '#f8fafc' : ok ? '#f0fdf4' : '#fef2f2'
    const col = ok === null ? '#555'    : ok ? '#16a34a' : '#dc2626'
    return `<tr style="background:${bg}"><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${req}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${col}">${result}</td></tr>`
  }).join('')

  const vRows = violations.length
    ? violations.map(v => `<tr><td>${v.date}</td><td>${v.pilot || '—'}</td><td style="color:#dc2626;font-weight:600">${v.type}</td><td>${v.detail}</td></tr>`).join('')
    : `<tr><td colspan="4" style="color:#16a34a;padding:10px">No violations recorded this quarter.</td></tr>`

  const exRows = exceedances.length
    ? exceedances.map(x => `<tr><td>${x.date}</td><td>${x.pilot || '—'}</td><td>${x.route}</td><td style="color:#dc2626;font-weight:600">${x.over}</td><td>${x.reason}</td><td>${x.reqRest}h</td></tr>`).join('')
    : `<tr><td colspan="6" style="color:#16a34a;padding:10px">No exceedances this quarter.</td></tr>`

  const sorted = [...qEntries].sort((a, b) => (ms(a.onBlocks) ?? ms(a.showTime) ?? 0) - (ms(b.onBlocks) ?? ms(b.showTime) ?? 0))

  const logRows = sorted.map(e => {
    if (e.restDay) return `<tr style="background:#f0fdf4"><td>${fmtDT(e.showTime)}</td><td>${e.pilot || '—'}</td><td colspan="12" style="color:#16a34a;font-weight:600">● 24-HOUR REST DAY</td></tr>`
    const c = compute(e, entries)
    if (e.part91) return `<tr style="background:#fffef0"><td>${fmtDT(e.showTime)}</td><td>${e.pilot || '—'}</td><td>${e.crew === 'D' ? 'Dual' : 'Single'}</td><td>${(e.dep || '—').toUpperCase()}→${(e.arr || '—').toUpperCase()}</td><td>${fmtDT(e.offBlocks)}</td><td>${fmtDT(e.onBlocks)}</td><td>${fmtHrs(c.legFlight)}</td><td colspan="7" style="color:#92400e;font-weight:600">▶ Part 91 — Excluded from §135.267 limits</td></tr>`
    return `<tr><td>${fmtDT(e.showTime)}</td><td>${e.pilot || '—'}</td><td>${e.crew === 'D' ? 'Dual' : 'Single'}</td><td>${(e.dep || '—').toUpperCase()}→${(e.arr || '—').toUpperCase()}</td><td>${fmtDT(e.offBlocks)}</td><td>${fmtDT(e.onBlocks)}</td><td>${fmtHrs(c.legFlight)}</td><td style="color:${c.flightOk===false?'#dc2626':'inherit'}">${c.rolling24!==null?fmtHrs(c.rolling24):'—'} / ${c.maxFlight}h</td><td>${flag(c.flightOk)}</td><td style="color:${c.dutyOk===false?'#dc2626':'inherit'}">${fmtHrs(c.dutyPeriod)}</td><td>${flag(c.dutyOk)}</td><td style="color:${c.restOk===false?'#dc2626':'inherit'}">${fmtHrs(c.consRest)} / ${c.reqRest}h</td><td>${flag(c.restOk)}</td><td>${c.excAmt > 0 ? fmtHrs(c.excAmt) : '—'}</td></tr>`
  }).join('')

  const pilots    = [...new Set(flightLegs.map(e => e.pilot).filter(Boolean))].join(', ') || 'All Pilots'
  const generated = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<title>FAR 135.267 Quarterly Report — ${qLabel} ${year}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; padding: 32px; font-size: 13px; }
h1 { font-size: 1.3rem; margin-bottom: 4px; }
h2 { font-size: 0.95rem; margin: 24px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
.meta { color: #666; font-size: 0.8rem; margin-bottom: 20px; }
.status-banner { background: ${overallOk ? '#f0fdf4' : '#fef2f2'}; border: 2px solid ${statusColor}; border-radius: 8px; padding: 12px 18px; color: ${statusColor}; font-weight: 700; font-size: 1rem; margin-bottom: 20px; }
.stat-box { background: #f8fafc; border-radius: 7px; padding: 12px 16px; display:inline-block; margin: 0 8px 8px 0; min-width:140px; }
.stat-box .val { font-size: 1.5rem; font-weight: 700; color: #2563eb; }
.stat-box .lbl { font-size: 0.75rem; color: #888; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 8px; }
th { background: #f8fafc; padding: 7px 10px; text-align: left; font-weight: 700; color: #555; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; white-space: nowrap; }
.disclaimer { margin-top: 28px; font-size: 0.72rem; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 10px; }
.print-btn { margin-bottom: 20px; padding: 8px 20px; background: #1a1a2e; color: white; border: none; border-radius: 7px; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
@media print { .no-print { display: none; } body { padding: 16px; } }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<h1>FAR 135.267 Quarterly Compliance Report</h1>
<div class="meta">Period: <strong>${qLabel} ${year}</strong> &nbsp;|&nbsp; Pilot(s): <strong>${pilots}</strong> &nbsp;|&nbsp; Generated: ${generated}</div>
<div class="status-banner">${overallOk ? '✓' : '⚠'} Overall Status: ${statusText}${!overallOk ? ` — ${totalViolations} violation(s) and/or rest day shortfall detected` : ''}</div>
<div style="margin-bottom:20px">
  <div class="stat-box"><div class="val">${part135Legs.length}</div><div class="lbl">Part 135 Legs${part91Legs.length ? `<br><span style="color:#92400e">(+${part91Legs.length} Part 91)</span>` : ''}</div></div>
  <div class="stat-box"><div class="val">${fmtHrs(totalFlight)}</div><div class="lbl">Total Flight Time</div></div>
  <div class="stat-box"><div class="val" style="color:${restMet?'#16a34a':'#dc2626'}">${restDays} / 13</div><div class="lbl">24-hr Rest Days</div></div>
  <div class="stat-box"><div class="val" style="color:${totalViolations===0?'#16a34a':'#dc2626'}">${totalViolations}</div><div class="lbl">Total Violations</div></div>
</div>
<h2>Scorecard</h2><table><thead><tr><th>Requirement</th><th>Result</th></tr></thead><tbody>${scRows}</tbody></table>
<h2>Violations Detail</h2><table><thead><tr><th>Date</th><th>Pilot</th><th>Type</th><th>Detail</th></tr></thead><tbody>${vRows}</tbody></table>
<h2>Exceedances</h2><table><thead><tr><th>Date</th><th>Pilot</th><th>Route</th><th>Over Limit</th><th>Reason</th><th>Req Rest</th></tr></thead><tbody>${exRows}</tbody></table>
<h2>Full Flight Log</h2>
<table><thead><tr><th>Show Time</th><th>Pilot</th><th>Crew</th><th>Route</th><th>Off Blocks</th><th>On Blocks</th><th>Leg Time</th><th>Rolling 24-hr</th><th>Flt✓</th><th>Duty</th><th>Duty✓</th><th>Rest After</th><th>Rest✓</th><th>Exc</th></tr></thead><tbody>${logRows}</tbody></table>
<div class="disclaimer">This report is for reference and record-keeping only. Always verify compliance with your OpSpec, POI, and company manual. Generated by FAR 135.267 Duty &amp; Flight Time Tracker.</div>
</body></html>`
}
