import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { localToUtcIso, utcToLocalParts } from '@/lib/timezone'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full text-[0.68rem] font-bold uppercase tracking-widest text-slate-400 mt-2">
      {children}
    </div>
  )
}

export function DTField({ label, date, time, onDate, onTime, tz, required }: {
  label: string; date: string; time: string
  onDate: (v: string) => void; onTime: (v: string) => void
  tz: string; required?: boolean
}) {
  const utc = localToUtcIso(date, time, tz)
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-semibold text-slate-500">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
      <div className="flex gap-1.5">
        <Input type="date" value={date} onChange={e => onDate(e.target.value)} className="text-sm h-8 flex-[1.5] appearance-none" />
        <Input type="time" value={time} onChange={e => onTime(e.target.value)} className="text-sm h-8 flex-1 min-w-0 appearance-none" />
      </div>
      {utc && <span className="text-[0.68rem] text-blue-400">→ {utc.slice(11, 16)}Z on {utc.slice(5, 10)}</span>}
    </div>
  )
}

export function splitForEdit(val: string, tz: string): { d: string; t: string } {
  if (!val) return { d: '', t: '' }
  if (val.endsWith('Z')) {
    const parts = utcToLocalParts(val, tz)
    return parts ? { d: parts.date, t: parts.time } : { d: '', t: '' }
  }
  const idx = val.indexOf('T')
  return idx >= 0 ? { d: val.slice(0, idx), t: val.slice(idx + 1) } : { d: val, t: '' }
}
