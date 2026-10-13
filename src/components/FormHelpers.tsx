import { Globe } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { localToUtcIso, localTimeHint, tzAbbr, tzOptions, deviceTz } from '@/lib/timezone'

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full text-[0.68rem] font-bold uppercase tracking-widest text-slate-400 mt-2">
      {children}
    </div>
  )
}

// Timezone picker that sits after a time input. Shows the zone name for the
// date being entered (PDT vs PST).
export function TzSelect({ tz, date, onChange }: { tz: string; date: string; onChange: (tz: string) => void }) {
  return (
    <Select value={tz} onValueChange={onChange}>
      <SelectTrigger className="text-sm h-8 w-auto gap-1 px-2 shrink-0" title="Timezone for this time" aria-label="Timezone">
        <Globe size={13} className="opacity-50 shrink-0" />
        <SelectValue>{tzAbbr(tz, date)}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {tzOptions(deviceTz(), tz).map(t => (
          <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Date + time inputs for a local time in `tz`. The label gets the zone name for
// the date being entered (PDT vs PST), and a preview of the time in Zulu.
export function DTField({ label, date, time, onDate, onTime, tz, onTz, required, onClear }: {
  label: string; date: string; time: string
  onDate: (v: string) => void; onTime: (v: string) => void
  tz: string; onTz?: (tz: string) => void; required?: boolean; onClear?: () => void
}) {
  const utc = localToUtcIso(date, time, tz)
  const hint = localTimeHint(date, time, tz)
  const hasValue = !!(date || time)
  return (
    <div className={`flex flex-col gap-1${onTz ? ' sm:col-span-2' : ''}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-500">{label}{!onTz && ` (${tzAbbr(tz, date)})`}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
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
        <Input type="time" value={time} onChange={e => onTime(e.target.value)} className="text-sm h-8 flex-1 min-w-0 appearance-none" />
        {onTz && <TzSelect tz={tz} date={date} onChange={onTz} />}
      </div>
      {utc && <span className="text-[0.68rem] text-blue-400">→ {utc.slice(11, 16)}Z on {utc.slice(5, 10)}</span>}
      {hint && <span className="text-[0.68rem] text-red-600">{hint}</span>}
    </div>
  )
}
