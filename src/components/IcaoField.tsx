import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { icaoMatches, useAirportsLoaded } from '@/lib/airports'

// Airport code input. After you leave the field, a 3-character code that matches
// a known airport offers "Confirm KSQL"; one with no match (L52) is left as typed.
// Never blocks saving.
export default function IcaoField({ label, value, onChange, placeholder, labelClassName, inputClassName, invalid, field, list }: {
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  labelClassName?: string
  inputClassName?: string
  invalid?: boolean
  field?: string     // data-field, for scrolling to an error
  list?: string      // <datalist> id of airports used before
}) {
  useAirportsLoaded()
  const [focused, setFocused] = useState(false)
  const [kept, setKept] = useState<string | null>(null)
  const matches = focused || kept === value ? [] : icaoMatches(value)

  return (
    <div className="flex flex-col gap-1" data-field={field}>
      <Label className={labelClassName}>{label}</Label>
      <Input
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        maxLength={4}
        list={list}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        // Suggestions still show while typing; the browser's dropdown arrow would hide the code.
        className={`[&::-webkit-calendar-picker-indicator]:hidden ${inputClassName ?? ''}`}
      />
      {matches.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          {matches.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className="text-[0.7rem] font-semibold whitespace-nowrap rounded px-1.5 py-0.5 text-amber-800 bg-amber-50 border border-amber-300 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900"
            >
              Confirm {m}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setKept(value)}
            className="text-[0.68rem] whitespace-nowrap text-slate-400 hover:text-slate-600 underline"
          >
            Keep {value}
          </button>
        </div>
      )}
    </div>
  )
}
