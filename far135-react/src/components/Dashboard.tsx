import { Card, CardContent } from '@/components/ui/card'
import { compute, fmtHrs, quarterRestCount } from '@/lib/calculations'
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
  const qCount = quarterRestCount(entries)

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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map(c => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  )
}
