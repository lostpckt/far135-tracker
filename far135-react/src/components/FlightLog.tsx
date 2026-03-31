import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pencil, X } from 'lucide-react'
import { compute, fmtDT, fmtHrs } from '@/lib/calculations'
import type { Entry } from '@/types/entry'

interface Props {
  entries: Entry[]
  onEdit: (entry: Entry) => void
  onDelete: (id: string) => void
}

function StatusBadge({ flag, okText, warnText }: { flag: boolean | null; okText: string; warnText: string }) {
  if (flag === null) return <Badge className="bg-slate-100 text-slate-400 text-[0.68rem]">N/A</Badge>
  return flag
    ? <Badge className="bg-green-50 text-green-700 text-[0.68rem]">✓ {okText}</Badge>
    : <Badge className="bg-red-50 text-red-700 text-[0.68rem]">⚠ {warnText}</Badge>
}

export default function FlightLog({ entries, onEdit, onDelete }: Props) {
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
    const aMs = (a.onBlocks ? new Date(a.onBlocks).getTime() : null) ?? (a.showTime ? new Date(a.showTime).getTime() : 0)
    const bMs = (b.onBlocks ? new Date(b.onBlocks).getTime() : null) ?? (b.showTime ? new Date(b.showTime).getTime() : 0)
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
                {['Show Time','Pilot','Crew','Route','Off Blocks','On Blocks','Leg Time','Rolling 24-hr','Flt OK?','Duty Period','Duty OK?','10-hr Lookback','Rest After','Rest OK?','Exceedance','Reason',''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 border-b-2 border-slate-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => {
                if (e.restDay) {
                  const anchor = e.showTime || e.offBlocks || ''
                  return (
                    <tr key={e.id} className="bg-green-50">
                      <td className="px-3 py-2 border-b border-slate-100">{fmtDT(anchor)}</td>
                      <td className="px-3 py-2 border-b border-slate-100 font-semibold">{e.pilot || '—'}</td>
                      <td className="px-3 py-2 border-b border-slate-100 text-green-700 font-semibold" colSpan={14}>
                        🟢 24-HOUR REST DAY — No flight duty
                      </td>
                      <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                        <button onClick={() => onEdit(e)} className="text-blue-500 hover:bg-blue-50 rounded p-1 mr-0.5"><Pencil size={13} /></button>
                        <button onClick={() => { if (confirm('Delete this entry?')) onDelete(e.id) }} className="text-red-500 hover:bg-red-50 rounded p-1"><X size={13} /></button>
                      </td>
                    </tr>
                  )
                }

                const c = compute(e, entries)
                const excBadge = c.excAmt > 0
                  ? <Badge className="bg-red-50 text-red-700 text-[0.68rem]">{fmtHrs(c.excAmt)}</Badge>
                  : <Badge className="bg-green-50 text-green-700 text-[0.68rem]">None</Badge>
                const p91Badge = e.part91
                  ? <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[0.68rem] ml-1">Part 91</Badge>
                  : null

                return (
                  <tr key={e.id} className={e.part91 ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{fmtDT(e.showTime)}</td>
                    <td className="px-3 py-2 border-b border-slate-100 font-semibold whitespace-nowrap">{e.pilot || '—'}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {e.crew === 'D' ? 'Dual' : 'Single'}{p91Badge}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {(e.dep || '—').toUpperCase()} → {(e.arr || '—').toUpperCase()}
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{fmtDT(e.offBlocks)}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{fmtDT(e.onBlocks)}</td>
                    <td className="px-3 py-2 border-b border-slate-100 font-semibold whitespace-nowrap">{fmtHrs(c.legFlight)}</td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">
                      {e.part91
                        ? <span className="text-amber-700 text-[0.7rem]">Excluded (Part 91)</span>
                        : <><span className="font-semibold">{c.rolling24 !== null ? fmtHrs(c.rolling24) : '—'}</span><br /><span className="text-[0.68rem] text-slate-400">Limit: {c.maxFlight}h</span></>
                      }
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100"><StatusBadge flag={e.part91 ? null : c.flightOk} okText="OK" warnText="EXCEEDED" /></td>
                    <td className="px-3 py-2 border-b border-slate-100 whitespace-nowrap">{fmtHrs(c.dutyPeriod)}</td>
                    <td className="px-3 py-2 border-b border-slate-100"><StatusBadge flag={e.part91 ? null : c.dutyOk} okText="OK" warnText="EXCEEDED" /></td>
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
