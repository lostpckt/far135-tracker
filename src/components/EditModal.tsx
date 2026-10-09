import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ms, parseHobbs, fmtHobbs, legTenths, overlappingDuty, flightExceedsDuty } from '@/lib/calculations'
import { localToUtcIso, localTimeHint, tzAbbr, splitForEdit } from '@/lib/timezone'
import { SectionLabel, DTField } from '@/components/FormHelpers'
import type { Entry } from '@/types/entry'

interface Props {
  entry: Entry
  entries: Entry[]
  tz: string
  onSave: (updated: Entry) => void
  onClose: () => void
}

export default function EditModal({ entry, entries, tz, onSave, onClose }: Props) {
  // State initialized from props on mount. Parent uses key={entry.id} to remount on entry change.
  const s  = splitForEdit(entry.showTime,    tz)
  const r  = splitForEdit(entry.releaseTime, tz)

  const [tailNumber, setTailNumber]   = useState(entry.tailNumber || '')
  const [entity, setEntity]           = useState(entry.entity || '')
  const [pilot]                        = useState(entry.pilot || '')
  const [crew, setCrew]               = useState<'S' | 'D'>(entry.crew || 'S')
  const [showDate, setShowDate]       = useState(s.d)
  const [showTime, setShowTime]       = useState(s.t)
  const [relDate, setRelDate]         = useState(r.d)
  const [relTime, setRelTime]         = useState(r.t)
  const [dep, setDep]                 = useState(entry.dep || '')
  const [arr, setArr]                 = useState(entry.arr || '')
  const [offHobbs, setOffHobbs]       = useState(entry.offBlocks || '')
  const [onHobbs, setOnHobbs]         = useState(entry.onBlocks || '')
  const [reason, setReason]           = useState(entry.reason || '')
  const [part91, setPart91]           = useState(!!entry.part91)
  const [err, setErr]                 = useState('')

  function handleSave() {
    setErr('')

    if (!tailNumber.trim()) { setErr('Aircraft tail number is required.'); return }
    if (!entity.trim()) { setErr('Entity is required for Part 135 flights.'); return }
    const offN = parseHobbs(offHobbs)
    const onN  = parseHobbs(onHobbs)
    if (!dep.trim()) { setErr('Departure ICAO is required.'); return }
    if (!arr.trim()) { setErr('Arrival ICAO is required.'); return }
    if (!offHobbs.trim() || !onHobbs.trim()) { setErr('Off Blocks and On Blocks Hobbs readings are required.'); return }
    if (offN === null || onN === null) { setErr('Hobbs readings must be in tenths of an hour, e.g. 12345.6.'); return }
    if (onN <= offN) { setErr('On Blocks Hobbs must be greater than Off Blocks Hobbs.'); return }
    const timeHint = localTimeHint(showDate, showTime, tz) ?? localTimeHint(relDate, relTime, tz)
    if (timeHint) { setErr(timeHint); return }
    const show    = localToUtcIso(showDate, showTime, tz)
    const release = localToUtcIso(relDate, relTime, tz)
    if (!show)    { setErr('Show Time is required.'); return }
    if (!release) { setErr('Release Time is required.'); return }
    if ((ms(release) ?? 0) <= (ms(show) ?? 0)) { setErr('Release Time must be after Show Time.'); return }
    if (overlappingDuty(entries, show, release, new Set([entry.id]))) {
      setErr('These times overlap another logged duty period. To move a whole multi-leg duty period, use its duty-period edit.')
      return
    }
    // This leg plus the other legs of the duty period it will belong to.
    const siblingFlight = entries
      .filter(e => e.id !== entry.id && !e.restDay && e.showTime === show && e.releaseTime === release)
      .reduce((sum, e) => sum + legTenths(e), 0)
    if (flightExceedsDuty(show, release, siblingFlight + (onN - offN))) {
      setErr('Total flight time for this duty period is longer than the duty period itself. Check the Hobbs readings and the Show/Release times.')
      return
    }

    onSave({
      ...entry,
      pilot,
      crew,
      tailNumber: tailNumber.trim() || undefined,
      entity: entity.trim() || undefined,
      showTime:    show,
      releaseTime: release,
      dep:         dep.toUpperCase().trim(),
      arr:         arr.toUpperCase().trim(),
      offBlocks:   fmtHobbs(offHobbs),
      onBlocks:    fmtHobbs(onHobbs),
      reason,
      part91,
    })
  }

  const abbr = tzAbbr(tz, showDate)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Edit Flight Entry</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 py-2">

          <SectionLabel>Identification</SectionLabel>
          <div className="col-span-full grid grid-cols-[8rem_1fr_auto] gap-2 items-start">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold text-slate-500">Tail Number <span className="text-red-500">*</span></Label>
              <Input value={tailNumber} onChange={e => setTailNumber(e.target.value.toUpperCase())} placeholder="N123AB" maxLength={8} className="text-sm h-8 uppercase w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold text-slate-500">Entity <span className="text-red-500">*</span></Label>
              <Input value={entity} onChange={e => setEntity(e.target.value)} placeholder="e.g. Acme Air LLC" className="text-sm h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold text-slate-500">Crew Configuration</Label>
              <Select value={crew} onValueChange={v => setCrew(v as 'S' | 'D')}>
                <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="S">Single Pilot — 8 hr limit</SelectItem>
                  <SelectItem value="D">Dual Pilot — 10 hr limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <SectionLabel>Duty Period — enter times in {abbr}</SectionLabel>
          <DTField label="Show Time"    date={showDate} time={showTime} onDate={setShowDate} onTime={setShowTime} tz={tz} required />
          <DTField label="Release Time" date={relDate}  time={relTime}  onDate={setRelDate}  onTime={setRelTime}  tz={tz} required />

          <SectionLabel>Flight Leg</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Departure ICAO <span className="text-red-500">*</span></Label>
            <Input value={dep} onChange={e => setDep(e.target.value.toUpperCase())} maxLength={4} className="text-sm h-8 uppercase" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Arrival ICAO <span className="text-red-500">*</span></Label>
            <Input value={arr} onChange={e => setArr(e.target.value.toUpperCase())} maxLength={4} className="text-sm h-8 uppercase" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Off Blocks (Hobbs) <span className="text-red-500">*</span></Label>
            <Input type="number" value={offHobbs} onChange={e => setOffHobbs(e.target.value)} placeholder="12345.6" step="0.1" min="0" className="text-sm h-8" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">On Blocks (Hobbs) <span className="text-red-500">*</span></Label>
            <Input type="number" value={onHobbs} onChange={e => setOnHobbs(e.target.value)} placeholder="12347.3" step="0.1" min="0" className="text-sm h-8" />
          </div>

          <SectionLabel>Other</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Exceedance Reason</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Weather divert" className="text-sm h-8" />
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 self-end">
            <Checkbox id="m-p91" checked={part91} onCheckedChange={v => setPart91(!!v)} />
            <label htmlFor="m-p91" className="text-xs font-semibold text-amber-800 cursor-pointer">
              Part 91 (exclude from 135 limits)
            </label>
          </div>

        </div>

        {err && <p className="text-red-600 text-xs mt-1">{err}</p>}

        <DialogFooter className="gap-2 mt-2">
          <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-sm h-8">Save Changes</Button>
          <Button variant="secondary" onClick={onClose} className="text-sm h-8">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
