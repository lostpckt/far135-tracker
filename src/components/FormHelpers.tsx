import { useId } from 'react'
import { Globe } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tzAbbr, tzOptions, deviceTz } from '@/lib/timezone'

// An error message shown right under the field it's about.
export function FieldError({ msg }: { msg?: string }) {
  return msg ? <span role="alert" className="text-xs text-red-600">{msg}</span> : null
}

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

// Example shown inside an empty date box, in the style iOS displays dates.
const DATE_EXAMPLE = 'e.g. ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// A date or time input that shows example text while it's empty. iOS Safari
// shows nothing in an empty date/time box (placeholder isn't supported), so the
// example is drawn over it; desktop browsers' own "mm/dd/yyyy" is hidden until focus.
export function DateTimeInput({ type, value, onChange, className, invalid, field }: {
  type: 'date' | 'time'
  value: string
  onChange: (v: string) => void
  className?: string     // sizing for the wrapper, e.g. flex-[1.5]
  invalid?: boolean
  field?: string         // data-field, for scrolling to an error
}) {
  const empty = !value
  return (
    <div className={`relative min-w-0 ${className ?? ''}`} data-field={field}>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={`peer text-sm h-8 w-full appearance-none ${empty ? '[&::-webkit-datetime-edit]:opacity-0 focus:[&::-webkit-datetime-edit]:opacity-100' : ''}`}
      />
      {empty && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground whitespace-nowrap peer-focus:hidden">
          {type === 'date' ? DATE_EXAMPLE : 'e.g. 07:15'}
        </span>
      )}
    </div>
  )
}

// Single / Dual pilot as two radio buttons; the filled dot shows the choice in
// either theme (the old segmented buttons relied on fill color alone).
export function CrewToggle({ value, onChange }: { value: 'S' | 'D'; onChange: (v: 'S' | 'D') => void }) {
  const name = useId()
  return (
    <div role="radiogroup" aria-label="Crew configuration" className="flex items-center gap-4 h-8">
      {(['S', 'D'] as const).map(v => (
        <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="radio"
            name={name}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
            className="size-4 accent-blue-600 cursor-pointer"
          />
          {v === 'S' ? 'Single' : 'Dual'}
        </label>
      ))}
    </div>
  )
}
