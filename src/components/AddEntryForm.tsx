import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import LegRow, { type LegData } from '@/components/LegRow'
import { SectionLabel } from '@/components/FormHelpers'
import { uid, ms, parseHobbs, overlappingDuty } from '@/lib/calculations'
import { localToUtcIso, tzAbbr } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

const DRAFT_KEY = 'far135_v1_form_draft'

interface DraftState {
  tailNumber: string
  entity: string
  crew: 'S' | 'D'
  showDate: string
  showTime: string
  relDate: string
  relTime: string
  legs: LegData[]
}

function readDraft(): DraftState | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') } catch { return null }
}

interface Props {
  entries: Entry[]
  onAdd: (updated: Entry[]) => void
  tz: string
}

function emptyLeg(): LegData {
  return { dep: '', arr: '', offHobbs: '', onHobbs: '', reason: '', part91: false }
}

function UtcPreview({ dateStr, timeStr, tz }: { dateStr: string; timeStr: string; tz: string }) {
  const utc = localToUtcIso(dateStr, timeStr, tz)
  if (!utc) return null
  return <span className="text-[0.68rem] text-blue-400">→ {utc.slice(11, 16)}Z on {utc.slice(5, 10)}</span>
}

export default function AddEntryForm({ entries, onAdd, tz }: Props) {
  const d = readDraft()

  const [tailNumber, setTailNumber] = useState(d?.tailNumber ?? '')
  const [entity, setEntity]         = useState(d?.entity ?? '')
  const [crew, setCrew]             = useState<'S' | 'D'>(d?.crew ?? 'S')
  const [showDate, setShowDate]     = useState(d?.showDate ?? new Date().toLocaleDateString('en-CA'))
  const [showTime, setShowTime]     = useState(d?.showTime ?? '')
  const [relDate, setRelDate]       = useState(d?.relDate ?? '')
  const [relTime, setRelTime]       = useState(d?.relTime ?? '')
  const [legs, setLegs]             = useState<LegData[]>(d?.legs ?? [emptyLeg()])
  const [err, setErr]               = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ tailNumber, entity, crew, showDate, showTime, relDate, relTime, legs }))
    } catch { /* localStorage unavailable */ }
  }, [tailNumber, entity, crew, showDate, showTime, relDate, relTime, legs])

  function resetForm() {
    setTailNumber(''); setEntity(''); setShowDate(''); setShowTime(''); setRelDate(''); setRelTime('')
    setLegs([emptyLeg()]); setErr('')
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* localStorage unavailable */ }
  }

  function handleAdd() {
    setErr('')

    if (!tailNumber.trim()) { setErr('Aircraft tail number is required.'); return }
    if (!entity.trim()) { setErr('Entity is required for Part 135 flights.'); return }

    const show    = localToUtcIso(showDate, showTime, tz)
    const release = localToUtcIso(relDate, relTime, tz)
    if (!show)    { setErr('Show Time is required.'); return }
    if (!release) { setErr('Release Time is required.'); return }
    if ((ms(release) ?? 0) <= (ms(show) ?? 0)) { setErr('Release Time must be after Show Time.'); return }
    if (overlappingDuty(entries, show, release, new Set())) { setErr('This duty period overlaps another logged duty period. Check the Show and Release times.'); return }

    const legData: { dep: string; arr: string; off: string; on: string; reason: string; part91: boolean }[] = []
    for (let i = 0; i < legs.length; i++) {
      const leg  = legs[i]
      const offN = parseHobbs(leg.offHobbs)
      const onN  = parseHobbs(leg.onHobbs)
      const label = legs.length > 1 ? `Leg ${i + 1}: ` : ''
      if (!leg.dep.trim()) { setErr(`${label}Departure ICAO is required.`); return }
      if (!leg.arr.trim()) { setErr(`${label}Arrival ICAO is required.`); return }
      if (offN === null || onN === null) { setErr(`${label}Off Blocks and On Blocks Hobbs readings are required.`); return }
      if (onN <= offN) { setErr(`${label}On Blocks Hobbs must be greater than Off Blocks Hobbs.`); return }
      legData.push({ dep: leg.dep, arr: leg.arr, off: leg.offHobbs.trim(), on: leg.onHobbs.trim(), reason: leg.reason, part91: leg.part91 })
    }

    const newEntries: Entry[] = legData.map(leg => ({
      id: uid(), pilot: '', crew,
      tailNumber: tailNumber.trim() || undefined,
      entity: entity.trim() || undefined,
      showTime: show, releaseTime: release,
      dep: leg.dep, arr: leg.arr,
      offBlocks: leg.off, onBlocks: leg.on,
      restStart: '', restEnd: '',
      reason: leg.reason, part91: leg.part91, restDay: false,
    }))

    onAdd([...entries, ...newEntries])
    resetForm()
  }

  const abbr = tzAbbr(tz)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Add Flight Leg</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">

          <div className="col-span-full grid grid-cols-[8rem_1fr_auto] gap-2 items-start">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold text-slate-500">Tail Number <span className="text-red-500">*</span></Label>
              <Input
                value={tailNumber}
                onChange={e => setTailNumber(e.target.value.toUpperCase())}
                placeholder="N123AB"
                maxLength={8}
                className="text-sm h-8 uppercase w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold text-slate-500">Entity <span className="text-red-500">*</span></Label>
              <Input
                value={entity}
                onChange={e => setEntity(e.target.value)}
                placeholder="e.g. Acme Air LLC"
                className="text-sm h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold text-slate-500">Crew Configuration</Label>
              <Select value={crew} onValueChange={v => setCrew(v as 'S' | 'D')}>
                <SelectTrigger className="text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="S">Single Pilot — 8 hr limit</SelectItem>
                  <SelectItem value="D">Dual Pilot — 10 hr limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectionLabel>Duty Period — enter times in {abbr}</SectionLabel>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Show Time ({abbr}) <span className="text-red-500">*</span></Label>
            <div className="flex gap-1.5">
              <Input type="date" value={showDate} onChange={e => setShowDate(e.target.value)} className="text-sm h-8 flex-[1.5] appearance-none" />
              <Input type="time" value={showTime} onChange={e => setShowTime(e.target.value)} className="text-sm h-8 flex-1 min-w-0 appearance-none" />
            </div>
            <UtcPreview dateStr={showDate} timeStr={showTime} tz={tz} />
            <span className="text-[0.68rem] text-slate-400">When you reported for duty (24-hr)</span>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Release Time ({abbr}) <span className="text-red-500">*</span></Label>
            <div className="flex gap-1.5">
              <Input type="date" value={relDate} onChange={e => setRelDate(e.target.value)} className="text-sm h-8 flex-[1.5] appearance-none" />
              <Input type="time" value={relTime} onChange={e => setRelTime(e.target.value)} className="text-sm h-8 flex-1 min-w-0 appearance-none" />
            </div>
            <UtcPreview dateStr={relDate} timeStr={relTime} tz={tz} />
            <span className="text-[0.68rem] text-slate-400">When duty officially ended (24-hr). Rest runs from here to your next Show Time.</span>
          </div>

          <SectionLabel>Flight Legs</SectionLabel>

          <div className="col-span-full">
            {legs.map((leg, i) => (
              <LegRow
                key={i}
                index={i}
                data={leg}
                onChange={updated => setLegs(legs.map((l, j) => j === i ? updated : l))}
                onRemove={() => setLegs(legs.filter((_, j) => j !== i))}
                showRemove={legs.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                const prev = legs[legs.length - 1]
                setLegs([...legs, { ...emptyLeg(), dep: prev?.arr ?? '', offHobbs: prev?.onHobbs ?? '' }])
              }}
              className="w-full border border-dashed border-blue-300 bg-blue-50 hover:bg-blue-600 hover:text-white hover:border-solid text-blue-600 text-sm font-semibold rounded-lg py-2 mt-1 transition-colors"
            >
              + Add Another Leg
            </button>
          </div>

        </div>

        {err && <p className="text-red-600 text-xs mt-3">{err}</p>}

        <div className="flex items-center justify-between mt-3">
          <span className="text-[0.68rem] text-slate-400">Draft autosaved</span>
          <button
            type="button"
            onClick={resetForm}
            className="text-[0.68rem] text-slate-400 hover:text-red-500 underline"
          >
            Clear form
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 mt-2 items-center">
          <Button onClick={handleAdd} className="bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm h-8">
            Add Entry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
