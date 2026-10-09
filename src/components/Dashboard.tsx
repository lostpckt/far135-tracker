import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { compute, fmtHrs, ms, quarterRestCount, quarterFlightHours, twoQuarterFlightHours, annualFlightHours } from '@/lib/calculations'
import { utcToLocalParts, tzAbbr, localYearMonth } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

interface Props {
  entries: Entry[]
  tz: string
}

function StatCard({
  label, value, sub, color,
}: {
  label: string
  value: string | number
  sub: string
  color: 'green' | 'red' | 'blue' | 'amber'
}) {
  const valueClass = {
    green: 'text-green-600',
    red:   'text-red-600',
    blue:  'text-blue-600',
    amber: 'text-amber-600',
  }[color]

  return (
    <Card className="h-full">
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-[0.7rem] text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
        <p className={`text-2xl font-bold leading-none ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

export default function Dashboard({ entries, tz }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const { year, monthIdx } = localYearMonth(tz, now)
  const qIdx   = Math.floor(monthIdx / 3)
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4']
  const prevQLabel = qIdx === 0 ? `Q4 ${year - 1}` : `${qLabels[qIdx - 1]} ${year}`

  const qCount   = quarterRestCount(entries, qIdx, year, tz, now.getTime())
  const qHours   = quarterFlightHours(entries, qIdx, year, tz)
  const tqHours  = twoQuarterFlightHours(entries, qIdx, year, tz)
  const annHours = annualFlightHours(entries, year, tz)

  const nonRestEntries = entries.filter(e => !e.restDay)
  const lastEntry = nonRestEntries.length ? nonRestEntries[nonRestEntries.length - 1] : null
  const lastCalc  = lastEntry ? compute(lastEntry, entries) : null

  const lastAnchorMs = lastEntry ? (ms(lastEntry.releaseTime) ?? ms(lastEntry.showTime)) : null
  const rollingWindowActive = lastAnchorMs !== null && (now.getTime() - lastAnchorMs) <= 86400000

  // §135.267 rest requirements never attach to Part 91 legs, so "Next Legal Duty"
  // must anchor on the last actual Part 135 duty period, not a trailing Part 91 leg.
  const p135Entries    = entries.filter(e => !e.restDay && !e.part91)
  const lastP135Entry  = p135Entries.length ? p135Entries[p135Entries.length - 1] : null
  const lastP135Calc   = lastP135Entry ? compute(lastP135Entry, entries) : null

  // Duty periods (not legs) with any Part 135 compliance failure.
  const violatingDuties = new Set(p135Entries.filter(e => {
    const c = compute(e, entries)
    return c.flightOk === false || c.dutyOk === false || c.restOk === false || c.lookbackOk === false
  }).map(e => `${e.showTime}|${e.releaseTime}`))
  const allWarnings = violatingDuties.size

  // Next legal duty start: the later of (a) the last Part 135 release plus its
  // required rest and (b) the last release of ANY duty, Part 91 included, plus
  // 10 h — a Part 91 duty after the last Part 135 one also needs 10 h of rest
  // before the next Part 135 duty can qualify under §135.267(c).
  type Color = 'green' | 'red' | 'blue' | 'amber'
  let nextDutyValue = '—'
  let nextDutySub   = ''
  let nextDutyColor: Color = 'blue'

  if (lastP135Entry?.releaseTime && lastP135Calc && lastP135Calc.reqRest !== null) {
    const releaseMs    = new Date(lastP135Entry.releaseTime).getTime()
    const lastAnyRelMs = Math.max(...nonRestEntries.map(e => ms(e.releaseTime) ?? 0))
    const legalMs      = Math.max(releaseMs + lastP135Calc.reqRest * 3600000, lastAnyRelMs + 10 * 3600000)
    const nowMs     = now.getTime()
    const legalIso  = new Date(legalMs).toISOString()
    const abbr      = tzAbbr(tz, utcToLocalParts(legalIso, tz)?.date)

    // Format the legal time in local timezone
    const local = utcToLocalParts(legalIso, tz)
    const localDate = local ? local.date.slice(5).replace('-', '/') : ''
    const localTime = local ? local.time : legalIso.slice(11, 16)
    const utcStr    = `${legalIso.slice(5, 10).replace('-', '/')} ${legalIso.slice(11, 16)}Z`

    if (nowMs >= legalMs) {
      nextDutyValue = 'Legal'
      nextDutySub   = `Since ${localDate} ${localTime} ${abbr}`
      nextDutyColor = 'green'
    } else {
      const remMs  = legalMs - nowMs
      const remHrs = Math.floor(remMs / 3600000)
      const remMin = Math.floor((remMs % 3600000) / 60000)
      nextDutyValue = `${localDate} ${localTime}`
      nextDutySub   = `${utcStr} · in ${remHrs}h ${String(remMin).padStart(2, '0')}m`
      nextDutyColor = remMs < 3600000 ? 'amber' : 'red'
    }
  }

  const cards: { label: string; value: string | number; sub: string; color: Color }[] = [
    {
      label: 'Total Legs Logged',
      value: nonRestEntries.length,
      sub:   `${new Set(nonRestEntries.map(e => `${e.showTime}|${e.releaseTime}`)).size} duty periods`,
      color: 'blue',
    },
    {
      label: 'Last Rolling 24-hr',
      value: !lastCalc || !rollingWindowActive ? '—' : fmtHrs(lastCalc.rolling24),
      sub:   !lastCalc ? 'No entries yet' : !rollingWindowActive ? 'Window cleared'
           : lastCalc.cQualifies ? `Duty period (c): ${fmtHrs(lastCalc.dutyFlight)} of ${lastCalc.maxFlight}h`
           : `Limit: ${lastCalc.maxFlight}h`,
      color: !lastCalc || !rollingWindowActive ? 'blue' : lastCalc.flightOk === false ? 'red' : 'green',
    },
    {
      label: 'Last Duty Period',
      value: lastCalc ? fmtHrs(lastCalc.dutyPeriod) : '—',
      sub:   'Limit: 14h',
      color: !lastCalc ? 'blue' : lastCalc.dutyOk === false ? 'red' : 'green',
    },
    {
      label: 'Next Legal Duty',
      value: nextDutyValue,
      sub:   nextDutySub,
      color: nextDutyColor,
    },
    {
      label: 'Quarter Rest Periods (24 h)',
      value: `${qCount} / 13`,
      sub:   qCount >= 13 ? 'Requirement met' : `Need ${13 - qCount} more`,
      color: qCount >= 13 ? 'green' : qCount >= 8 ? 'amber' : 'red',
    },
    {
      label: 'Active Violations',
      value: allWarnings,
      sub:   allWarnings === 0 ? 'All duty periods compliant' : `Duty period${allWarnings !== 1 ? 's' : ''} flagged in the log`,
      color: allWarnings === 0 ? 'green' : 'red',
    },
  ]

  const cumulativeCards: { label: string; value: string | number; sub: string; color: Color }[] = [
    {
      label: `§135.267(a) ${qLabels[qIdx]} ${year}`,
      value: fmtHrs(qHours),
      // §135.267(a) limits may not be *exceeded* — exactly at the limit is legal.
      sub:   qHours > 500 ? '⚠ 500h quarterly limit EXCEEDED' : `${fmtHrs(500 - qHours)} remaining of 500h`,
      color: qHours > 500 ? 'red' : qHours >= 450 ? 'amber' : 'blue',
    },
    {
      label: `${prevQLabel}–${qLabels[qIdx]} Combined`,
      value: fmtHrs(tqHours),
      sub:   tqHours > 800 ? '⚠ 800h two-quarter limit EXCEEDED' : `${fmtHrs(800 - tqHours)} remaining of 800h`,
      color: tqHours > 800 ? 'red' : tqHours >= 750 ? 'amber' : 'blue',
    },
    {
      label: `${year} Annual Hours`,
      value: fmtHrs(annHours),
      sub:   annHours > 1400 ? '⚠ 1,400h annual limit EXCEEDED' : `${fmtHrs(1400 - annHours)} remaining of 1,400h`,
      color: annHours > 1400 ? 'red' : annHours >= 1300 ? 'amber' : 'blue',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {cards.map(c => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {cumulativeCards.map(c => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
    </div>
  )
}
