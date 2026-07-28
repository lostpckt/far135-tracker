import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { localToUtcIso } from '@/lib/timezone'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full text-[0.68rem] font-bold uppercase tracking-widest text-slate-400 mt-2">
      {children}
    </div>
  )
}

export function DTField({ label, date, time, onDate, onTime, tz, required, onClear }: {
  label: string; date: string; time: string
  onDate: (v: string) => void; onTime: (v: string) => void
  tz: string; required?: boolean; onClear?: () => void
}) {
  const utc = localToUtcIso(date, time, tz)
  const hasValue = !!(date || time)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-500">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
        {onClear && hasValue && (
          <button
            type="button"
            onClick={onClear}
            className="text-[0.68rem] text-slate-400 hover:text-red-500 leading-none px-1"
            aria-label={`Clear ${label}`}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input type="date" value={date} onChange={e => onDate(e.target.value)} className="text-sm h-8 flex-[1.5] appearance-none" />
        <Input type="time" step={300} value={time} onChange={e => onTime(e.target.value)} className="text-sm h-8 flex-1 min-w-0 appearance-none" />
      </div>
      {utc && <span className="text-[0.68rem] text-blue-400">→ {utc.slice(11, 16)}Z on {utc.slice(5, 10)}</span>}
    </div>
  )
}
