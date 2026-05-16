import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pencil, X } from 'lucide-react'
import { compute, fmtDT, fmtHrs } from '@/lib/calculations'
import { utcToLocalParts } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

interface Props {
  entries: Entry[]
  tz: string
  onEdit: (entry: Entry) => void
  onDelete: (id: string) => void
}

function StatusBadge({ flag, okText, warnText }: { flag: boolean | null; okText: string; warnText: string }) {
  if (flag === null) return <Badge className="bg-slate-100 text-slate-400 text-[0.68rem]">N/A</Badge>
  return flag
    ? <Badge className="bg-green-50 text-green-700 text-[0.68rem]">✓ {okText}</Badge>
    : <Badge className="bg-red-50 text-red-700 text-[0.68rem]">⚠ {warnText}</Badge>
}

export default function FlightLog({ entries, tz, onEdit, onDelete }: Props) {
  if (!entries.length) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Flight Log</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center py-12 text-slate-400">No entries yet — add your first flight leg above.</p>
        </CardContent>
      </Card>
    )
  }

  const sorted = [...entries].sort((a, b) => {
    const aMs = a.showTime ? new Date(a.showTime).getTime() : 0
    const bMs = b.showTime ? new Date(b.showTime).getTime() : 0
    return aMs - bMs
  })

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Flight Log</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                {['Show Time','Release Time','Pilot','Crew','Route','Off Blocks','On Blocks','Leg Time','Rolling 24-hr','Flt OK?','Duty Period','Duty OK?','10-hr Lookback','Rest After','Rest OK?','Exceedance','Reason',''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 border-b-2 border-slate-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => {
                if (e.restDay) {
                  const anchor = e.showTime || ''
                  // Show the local date for rest days (they're calendar markers, not point-in-time)
                  const localDate = anchor.endsWith('Z')
                    ? (utcToLocalParts(anchor, tz)?.date ?? anchor.slice(0, 10))
                    : anchor.slice(0, 10)
                  const localDateFmt = localDate.slice(5).replace('-', '/')
                  return (
                    <tr key={e.id} className="bg-green-50 dark:bg-green-950">
                      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">{localDateFmt}</td>
                      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">—</td>
                      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 font-semibold">{e.pilot || '—'}</td>
                      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-green-700 dark:text-green-400 font-semibold" colSpan={14}>
                        {e.restDayEnd && e.restDayEnd !== localDate
                          ? `🟢 24-HOUR REST DAYS: ${localDate} – ${e.restDayEnd}`
                          : '🟢 24-HOUR REST DAY — No flight duty'}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                        <button onClick={() => onEdit(e)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 rounded p-1 mr-0.5"><Pencil size={13} /></button>
                        <button onClick={() => { if (confirm('Delete this entry?')) onDelete(e.id) }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded p-1"><X size={13} /></button>
                      </td>
                    </tr>
                  )
                }

                const c = compute(e, entries, tz)
                const excBadge = c.excAmt > 0
                  ? <Badge className="bg-red-50 text-red-700 text-[0.68rem]">{fmtHrs(c.excAmt)}</Badge>
                  : <Badge className="bg-green-50 text-green-700 text-[0.68rem]">None</Badge>
                const p91Badge = e.part91
                  ? <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[0.68rem] ml-1">Part 91</Badge>
                  : null

                return (
                  <tr key={e.id} className={e.part91 ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{fmtDT(e.showTime)}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{e.releaseTime ? fmtDT(e.releaseTime) : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2 border-b border-slate-100 font-semibold whitespace-nowrap">{e.pilot || '—'}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {e.crew === 'D' ? 'Dual' : 'Single'}{p91Badge}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {(e.dep || '—').toUpperCase()} → {(e.arr || '—').toUpperCase()}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{e.offBlocks || '—'}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{e.onBlocks || '—'}</td>
                    <td className="px-3 py-2 border-b border-slate-100 font-semibold whitespace-nowrap">{fmtHrs(c.legFlight)}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {e.part91
                        ? <span className="text-amber-700 text-[0.7rem]">Excluded (Part 91)</span>
                        : <><span className="font-semibold">{c.rolling24 !== null ? fmtHrs(c.rolling24) : '—'}</span><br /><span className="text-[0.68rem] text-slate-400">Limit: {c.maxFlight}h</span></>
                      }
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100"><StatusBadge flag={e.part91 ? null : c.flightOk} okText="OK" warnText="EXCEEDED" /></td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{fmtHrs(c.dutyPeriod)}</td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <StatusBadge flag={e.part91 ? null : c.dutyOk} okText="OK" warnText="EXCEEDED" />
                      {!e.part91 && c.dutyOk === false && c.dutyPeriod !== null && (
                        <div className="text-[0.65rem] text-red-600 mt-0.5 whitespace-nowrap">
                          +{fmtHrs(c.dutyPeriod - 14)} over · min {c.reqRest}h rest req'd
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100"><StatusBadge flag={e.part91 ? null : c.lookbackOk} okText="10-hr met" warnText="CHECK REST" /></td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {fmtHrs(c.consRest)}<br />
                      {!e.part91 && <span className="text-[0.68rem] text-slate-400">Req: {c.reqRest}h</span>}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100"><StatusBadge flag={e.part91 ? null : c.restOk} okText="OK" warnText="DEFICIENT" /></td>
                    <td className="px-3 py-2 border-b border-slate-100">{e.part91 ? <Badge className="bg-slate-100 text-slate-400 text-[0.68rem]">N/A</Badge> : excBadge}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{e.reason || '—'}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      <button onClick={() => onEdit(e)} className="text-blue-500 hover:bg-blue-50 rounded p-1 mr-0.5"><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm('Delete this entry?')) onDelete(e.id) }} className="text-red-500 hover:bg-red-50 rounded p-1"><X size={13} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
