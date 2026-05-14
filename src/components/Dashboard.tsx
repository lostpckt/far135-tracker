import { Card, CardContent } from '@/components/ui/card'
import { compute, fmtHrs, quarterRestCount, quarterFlightHours, twoQuarterFlightHours, annualFlightHours } from '@/lib/calculations'
import type { Entry } from '@/types/entry'

interface Props {
  entries: Entry[]
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
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-[0.7rem] text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
        <p className={`text-2xl font-bold leading-none ${valueClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
      </CardContent>
    </Card>
  )
}

export default function Dashboard({ entries }: Props) {
  const now    = new Date()
  const qIdx   = Math.floor(now.getMonth() / 3)
  const year   = now.getFullYear()
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4']
  const prevQLabel = qIdx === 0 ? `Q4 ${year - 1}` : `${qLabels[qIdx - 1]} ${year}`

  const qCount   = quarterRestCount(entries)
  const qHours   = quarterFlightHours(entries, qIdx, year)
  const tqHours  = twoQuarterFlightHours(entries, qIdx, year)
  const annHours = annualFlightHours(entries, year)

  const nonRestEntries = entries.filter(e => !e.restDay)
  const lastCalc = nonRestEntries.length
    ? compute(nonRestEntries[nonRestEntries.length - 1], entries)
    : null

  const allWarnings = entries.filter(e => {
    if (e.restDay) return false
    const c = compute(e, entries)
    return c.flightOk === false || c.dutyOk === false || c.restOk === false
  }).length

  type Color = 'green' | 'red' | 'blue' | 'amber'
  const cards: { label: string; value: string | number; sub: string; color: Color }[] = [
    {
      label: 'Total Legs Logged',
      value: entries.filter(e => !e.restDay).length,
      sub:   `${entries.filter(e => e.restDay).length} rest-day entries`,
      color: 'blue',
    },
    {
      label: 'Last Rolling 24-hr',
      value: lastCalc ? fmtHrs(lastCalc.rolling24) : '—',
      sub:   lastCalc ? `Limit: ${lastCalc.maxFlight}h` : 'No entries yet',
      color: !lastCalc ? 'blue' : lastCalc.flightOk === false ? 'red' : 'green',
    },
    {
      label: 'Last Duty Period',
      value: lastCalc ? fmtHrs(lastCalc.dutyPeriod) : '—',
      sub:   'Limit: 14h',
      color: !lastCalc ? 'blue' : lastCalc.dutyOk === false ? 'red' : 'green',
    },
    {
      label: 'Last Rest Period',
      value: lastCalc ? fmtHrs(lastCalc.consRest) : '—',
      sub:   lastCalc ? `Required: ${lastCalc.reqRest}h` : '',
      color: !lastCalc ? 'blue' : lastCalc.restOk === false ? 'red' : 'green',
    },
    {
      label: 'Quarter Rest Days',
      value: `${qCount} / 13`,
      sub:   qCount >= 13 ? 'Requirement met' : `Need ${13 - qCount} more`,
      color: qCount >= 13 ? 'green' : qCount >= 8 ? 'amber' : 'red',
    },
    {
      label: 'Active Violations',
      value: allWarnings,
      sub:   allWarnings === 0 ? 'All entries compliant' : 'Review flagged rows',
      color: allWarnings === 0 ? 'green' : 'red',
    },
  ]

  const cumulativeCards: { label: string; value: string | number; sub: string; color: Color }[] = [
    {
      label: `§135.267(a) ${qLabels[qIdx]} ${year}`,
      value: fmtHrs(qHours),
      sub:   qHours >= 500 ? '⚠ 500h quarterly limit EXCEEDED' : `${fmtHrs(500 - qHours)} remaining of 500h`,
      color: qHours >= 500 ? 'red' : qHours >= 450 ? 'amber' : 'blue',
    },
    {
      label: `${prevQLabel}–${qLabels[qIdx]} Combined`,
      value: fmtHrs(tqHours),
      sub:   tqHours >= 800 ? '⚠ 800h two-quarter limit EXCEEDED' : `${fmtHrs(800 - tqHours)} remaining of 800h`,
      color: tqHours >= 800 ? 'red' : tqHours >= 750 ? 'amber' : 'blue',
    },
    {
      label: `${year} Annual Hours`,
      value: fmtHrs(annHours),
      sub:   annHours >= 1400 ? '⚠ 1,400h annual limit EXCEEDED' : `${fmtHrs(1400 - annHours)} remaining of 1,400h`,
      color: annHours >= 1400 ? 'red' : annHours >= 1300 ? 'amber' : 'blue',
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
