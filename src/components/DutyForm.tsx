import { useState, useEffect, useMemo, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LegRow, { type LegData, type LegField } from '@/components/LegRow'
import { SectionLabel, TzSelect, CrewToggle, DateTimeInput, FieldError } from '@/components/FormHelpers'
import { uid, ms, parseHobbs, fmtHobbs, fmtHrs, legTenths, compute, overlappingDuty, flightExceedsDuty, hobbsConflict, hobbsConflictMsg } from '@/lib/calculations'
import { localToUtcIso, localTimeHint } from '@/lib/timezone'
import { useFieldError } from '@/lib/useFieldError'
import { emptyLeg } from '@/lib/legs'
import type { Entry } from '@/types/entry'

export interface DutyFormState {
  tailNumber: string
  entity: string
  crew: 'S' | 'D'
  showDate: string
  showTime: string
  relDate: string
  relTime: string
  showTz: string
  relTz: string
  reason: string        // exceedance reason, for the whole duty
  legs: LegData[]
}

interface Props {
  initial: DutyFormState
  entries: Entry[]
  tz: string
  /** Legs of the logged duty being edited; omitted when adding a new one. */
  editing?: Entry[]
  /** Editing a duty whose legs have different tail numbers / entities: blank keeps each leg's own. */
  mixed?: { tail?: boolean; entity?: boolean }
  onChange?: (state: DutyFormState) => void   // draft autosave
  onSubmit: (legs: Entry[]) => void
  onClear?: () => void                        // add mode: "Clear form"
  onCancel?: () => void                       // edit mode
}

function UtcPreview({ dateStr, timeStr, tz }: { dateStr: string; timeStr: string; tz: string }) {
  const hint = localTimeHint(dateStr, timeStr, tz)
  if (hint) return <span className="text-[0.68rem] text-red-600">{hint}</span>
  const utc = localToUtcIso(dateStr, timeStr, tz)
  if (!utc) return null
  return <span className="text-[0.68rem] text-blue-400">→ {utc.slice(11, 16)}Z on {utc.slice(5, 10)}</span>
}

// Distinct non-empty values, most recently logged first.
function recent(entries: Entry[], pick: (e: Entry) => (string | undefined)[]): string[] {
  const seen = new Set<string>()
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].restDay) continue
    for (const v of pick(entries[i])) { const t = v?.trim(); if (t) seen.add(t) }
  }
  return [...seen]
}

// The duty entry form: used by the Add Duty Entry card and the Edit Duty Entry dialog.
export default function DutyForm({ initial, entries, tz, editing, mixed = {}, onChange, onSubmit, onClear, onCancel }: Props) {
  const id = useId()
  const [tailNumber, setTailNumber] = useState(initial.tailNumber)
  const [entity, setEntity]         = useState(initial.entity)
  const [crew, setCrew]             = useState(initial.crew)
  const [showDate, setShowDate]     = useState(initial.showDate)
  const [showTime, setShowTime]     = useState(initial.showTime)
  const [relDate, setRelDate]       = useState(initial.relDate)
  const [relTime, setRelTime]       = useState(initial.relTime)
  const [showTz, setShowTz]         = useState(initial.showTz)
  const [relTz, setRelTz]           = useState(initial.relTz)
  const [reason, setReason]         = useState(initial.reason ?? '')
  const [legs, setLegs]             = useState<LegData[]>(() => initial.legs.map(l => ({ ...l, key: l.key ?? uid() })))

  const values = [tailNumber, entity, crew, showDate, showTime, relDate, relTime, showTz, relTz, reason, legs]
  const err = useFieldError(values)

  useEffect(() => {
    onChange?.({ tailNumber, entity, crew, showDate, showTime, relDate, relTime, showTz, relTz, reason, legs })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, values)

  // Autocomplete from what's been logged before.
  const tails    = useMemo(() => recent(entries, e => [e.tailNumber]), [entries])
  const entities = useMemo(() => recent(entries, e => [e.entity]), [entries])
  const airports = useMemo(() => recent(entries, e => [e.dep, e.arr]), [entries])

  const keepTail   = !!mixed.tail && !tailNumber.trim()
  const keepEntity = !!mixed.entity && !entity.trim()

  const editIds = useMemo(() => new Set(editing?.map(l => l.id) ?? []), [editing])

  // The duty as it would be saved. Edited legs keep everything not on this form (id, pilot, legacy fields).
  function buildLegs(show: string, release: string): Entry[] {
    const first = editing?.[0]
    return legs.map(leg => {
      const base = leg.id ? editing?.find(e => e.id === leg.id) : undefined
      const own  = base ?? first
      return {
        ...(base ?? { id: uid(), pilot: first?.pilot ?? '', restStart: '', restEnd: '', restDay: false }),
        crew,
        tailNumber: keepTail   ? own?.tailNumber : tailNumber.trim() || undefined,
        entity:     keepEntity ? own?.entity     : entity.trim() || undefined,
        showTime: show, releaseTime: release, showTz, releaseTz: relTz,
        dep: leg.dep, arr: leg.arr,
        offBlocks: fmtHobbs(leg.offHobbs), onBlocks: fmtHobbs(leg.onHobbs),
        reason: reason.trim(), part91: leg.part91,
      }
    })
  }

  // Hours over the §135.267 flight time limit, checked live against everything
  // logged, so the Exceedance Reason box appears only when it's needed. Every
  // Part 135 leg of a duty shares its release-anchored window, so it's one
  // figure for the whole duty.
  const show    = localToUtcIso(showDate, showTime, showTz)
  const release = localToUtcIso(relDate, relTime, relTz)
  const excess = useMemo(() => {
    if (!show || !release || (ms(release) ?? 0) <= (ms(show) ?? 0)) return 0
    const draft = buildLegs(show, release).filter(e => parseHobbs(e.offBlocks) !== null && parseHobbs(e.onBlocks) !== null)
    const all = [...entries.filter(e => !editIds.has(e.id)), ...draft]
    return Math.max(0, ...draft.filter(e => !e.part91).map(e => compute(e, all).excAmt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, editIds, ...values])
  const showReason = excess > 0 || !!reason.trim()

  function submit() {

    if (!tailNumber.trim() && !keepTail) return err.fail('Aircraft tail number is required.', 'tail')
    if (!entity.trim() && !keepEntity)   return err.fail('Entity is required.', 'entity')

    const showHint = localTimeHint(showDate, showTime, showTz)
    if (showHint) return err.fail(showHint, 'show')
    const relHint = localTimeHint(relDate, relTime, relTz)
    if (relHint) return err.fail(relHint, 'release')
    if (!show)    return err.fail('Show Time is required.', 'show')
    if (!release) return err.fail('Release Time is required.', 'release')
    if ((ms(release) ?? 0) <= (ms(show) ?? 0)) return err.fail('Release Time must be after Show Time.', 'release')
    if (overlappingDuty(entries, show, release, editIds)) {
      return err.fail('This duty period overlaps another logged duty period. Check the Show and Release times.', 'show')
    }

    const legFail = (i: number, f: LegField, msg: string) => err.fail(msg, `leg${i}-${f}`)
    for (let i = 0; i < legs.length; i++) {
      const leg  = legs[i]
      const offN = parseHobbs(leg.offHobbs)
      const onN  = parseHobbs(leg.onHobbs)
      if (!leg.dep.trim())      return legFail(i, 'dep', 'Departure ICAO is required.')
      if (!leg.arr.trim())      return legFail(i, 'arr', 'Arrival ICAO is required.')
      if (!leg.offHobbs.trim()) return legFail(i, 'off', 'Off Blocks is required.')
      if (!leg.onHobbs.trim())  return legFail(i, 'on', 'On Blocks is required.')
      if (offN === null)        return legFail(i, 'off', 'Hobbs readings must be in tenths of an hour, e.g. 1234.5.')
      if (onN === null)         return legFail(i, 'on', 'Hobbs readings must be in tenths of an hour, e.g. 1234.5.')
      if (onN <= offN)          return legFail(i, 'on', 'On Blocks must be greater than Off Blocks.')
      if (i > 0 && offN < (parseHobbs(legs[i - 1].onHobbs) ?? 0)) {
        return legFail(i, 'off', `Off Blocks can't be below Leg ${i}'s On Blocks.`)
      }
    }
    const totalFlight = legs.reduce((sum, l) => sum + legTenths({ offBlocks: l.offHobbs, onBlocks: l.onHobbs }), 0)
    if (flightExceedsDuty(show, release, totalFlight)) {
      return err.fail('Total flight time is longer than the duty period itself. Check the Hobbs readings and the Show/Release times.')
    }

    const out = buildLegs(show, release)
    const others = entries.filter(e => !editIds.has(e.id))
    for (let i = 0; i < out.length; i++) {
      const other = hobbsConflict(others, out[i], new Set())
      if (other) return legFail(i, 'off', hobbsConflictMsg(other, tz))
    }
    if (excess > 0 && !reason.trim()) {
      return err.fail('Enter the reason for the exceedance.', 'reason')
    }

    onSubmit(out)
  }

  function moveLeg(i: number, by: -1 | 1) {
    const next = [...legs]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setLegs(next)
  }

  const legErr = (i: number) => {
    const f = err.error?.field
    return f?.startsWith(`leg${i}-`) ? { field: f.split('-')[1] as LegField, msg: err.error!.msg } : undefined
  }
  // A Show/Release time that doesn't exist is already explained under its picker.
  const timeErr = (f: 'show' | 'release', hint: string | null) => {
    const m = err.at(f)
    return m && m !== hint ? m : undefined
  }
  const idErr = err.at('tail') ?? err.at('entity')

  return (
    <div ref={err.rootRef} className="@container">
      <div className="flex flex-col gap-3.5">

        <div className="grid grid-cols-2 @md:grid-cols-[8rem_1fr_auto] gap-2 items-start">
          <div className="flex flex-col gap-1" data-field="tail">
            <Label htmlFor={`${id}-tail`} className="text-xs font-semibold text-slate-500">
              Tail Number {!mixed.tail && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={`${id}-tail`}
              value={tailNumber}
              onChange={e => setTailNumber(e.target.value.toUpperCase())}
              placeholder={mixed.tail ? 'Varies by leg' : 'N123AB'}
              maxLength={8}
              list={`${id}-tails`}
              autoComplete="off"
              aria-invalid={!!err.at('tail') || undefined}
              className="text-sm h-8 uppercase w-full"
            />
          </div>
          <div className="flex flex-col gap-1" data-field="entity">
            <Label htmlFor={`${id}-entity`} className="text-xs font-semibold text-slate-500">
              Entity {!mixed.entity && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={`${id}-entity`}
              value={entity}
              onChange={e => setEntity(e.target.value)}
              placeholder={mixed.entity ? 'Varies by leg' : 'e.g. Acme Air LLC'}
              list={`${id}-entities`}
              autoComplete="off"
              aria-invalid={!!err.at('entity') || undefined}
              className="text-sm h-8"
            />
          </div>
          <div className="col-span-2 @md:col-span-1 flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Crew Configuration</Label>
            <CrewToggle value={crew} onChange={setCrew} />
          </div>
          {(mixed.tail || mixed.entity) && (
            <span className="col-span-full text-[0.68rem] text-slate-400">
              This duty's legs have different {mixed.tail && mixed.entity ? 'tail numbers and entities' : mixed.tail ? 'tail numbers' : 'entities'}.
              Leave a "Varies by leg" box blank to keep each leg's own, or fill it in to set every leg.
            </span>
          )}
          {idErr && <div className="col-span-full"><FieldError msg={idErr} /></div>}
        </div>

        <SectionLabel>Duty Period</SectionLabel>

        <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-3.5 -mt-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Label className="text-xs font-semibold text-slate-500">Show Time <span className="text-red-500">*</span></Label>
              <span className="text-[0.68rem] text-slate-400">When you reported for duty (24-hr)</span>
            </div>
            <div className="flex gap-1.5">
              <DateTimeInput type="date" value={showDate} onChange={setShowDate} className="flex-[1.5]" invalid={!!err.at('show')} field="show" />
              <DateTimeInput type="time" value={showTime} onChange={setShowTime} className="flex-1" invalid={!!err.at('show')} />
              <TzSelect tz={showTz} date={showDate} onChange={setShowTz} />
            </div>
            <UtcPreview dateStr={showDate} timeStr={showTime} tz={showTz} />
            <FieldError msg={timeErr('show', localTimeHint(showDate, showTime, showTz))} />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Label className="text-xs font-semibold text-slate-500">Release Time <span className="text-red-500">*</span></Label>
              <span className="text-[0.68rem] text-slate-400">When duty officially ended (24-hr); rest starts here</span>
            </div>
            <div className="flex gap-1.5">
              <DateTimeInput type="date" value={relDate} onChange={setRelDate} className="flex-[1.5]" invalid={!!err.at('release')} field="release" />
              <DateTimeInput type="time" value={relTime} onChange={setRelTime} className="flex-1" invalid={!!err.at('release')} />
              <TzSelect tz={relTz} date={relDate || showDate} onChange={setRelTz} />
            </div>
            <UtcPreview dateStr={relDate} timeStr={relTime} tz={relTz} />
            <FieldError msg={timeErr('release', localTimeHint(relDate, relTime, relTz))} />
          </div>
        </div>

        <SectionLabel>Flight Legs</SectionLabel>

        <div className="-mt-2">
          {legs.map((leg, i) => (
            <LegRow
              key={leg.key}
              index={i}
              data={leg}
              onChange={updated => setLegs(legs.map((l, j) => j === i ? updated : l))}
              onRemove={i > 0 ? () => setLegs(legs.filter((_, j) => j !== i)) : undefined}
              onMoveUp={legs.length > 1 && i > 0 ? () => moveLeg(i, -1) : undefined}
              onMoveDown={legs.length > 1 && i < legs.length - 1 ? () => moveLeg(i, 1) : undefined}
              error={legErr(i)}
              airportList={`${id}-airports`}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              const prev = legs[legs.length - 1]
              setLegs([...legs, { ...emptyLeg(), dep: prev?.arr ?? '', offHobbs: prev?.onHobbs ?? '' }])
            }}
            className="w-full border border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 hover:bg-blue-600 hover:text-white hover:border-solid text-blue-600 dark:text-blue-400 text-sm font-semibold rounded-lg py-2 mt-1 transition-colors"
          >
            + Add Another Leg
          </button>
        </div>

        {showReason && (
          <div data-field="reason" className={`flex flex-col gap-1 rounded-lg border p-3 ${excess > 0
            ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
            : 'border-slate-200 dark:border-slate-700'}`}>
            <Label htmlFor={`${id}-reason`} className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Exceedance Reason {excess > 0 && <span className="text-red-500">*</span>}
            </Label>
            <span className={`text-[0.68rem] ${excess > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-400'}`}>
              {excess > 0
                ? `Over the flight time limit by ${fmtHrs(excess)}. Required to save.`
                : 'No exceedance with these times and Hobbs readings. Clear this if it no longer applies.'}
            </span>
            <Input
              id={`${id}-reason`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Weather divert"
              aria-invalid={!!err.at('reason') || undefined}
              className="text-sm h-8 bg-background"
            />
            <FieldError msg={err.at('reason')} />
          </div>
        )}
      </div>

      <datalist id={`${id}-tails`}>{tails.map(t => <option key={t} value={t} />)}</datalist>
      <datalist id={`${id}-entities`}>{entities.map(t => <option key={t} value={t} />)}</datalist>
      <datalist id={`${id}-airports`}>{airports.map(t => <option key={t} value={t} />)}</datalist>

      {err.general && <p role="alert" className="text-red-600 text-xs mt-3">{err.general}</p>}

      {editing ? (
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={submit} className="bg-green-600 hover:bg-green-700 text-white text-sm h-8">Save Changes</Button>
          <Button variant="secondary" onClick={onCancel} className="text-sm h-8">Cancel</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mt-3">
            <span className="text-[0.68rem] text-slate-400">Draft autosaved</span>
            <button type="button" onClick={onClear} className="text-[0.68rem] text-slate-400 hover:text-red-500 underline">
              Clear form
            </button>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-2 items-center">
            <Button onClick={submit} className="bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm h-8">
              Add to Flight Log
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
