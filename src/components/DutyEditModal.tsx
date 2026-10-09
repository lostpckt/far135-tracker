import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ms, parseHobbs, hobbsFlightTime, overlappingDuty, flightExceedsDuty } from '@/lib/calculations'
import { localToUtcIso, localTimeHint, tzAbbr, splitForEdit } from '@/lib/timezone'
import { SectionLabel, DTField } from '@/components/FormHelpers'
import type { Entry } from '@/types/entry'

interface Props {
  legs: Entry[]
  entries: Entry[]
  tz: string
  onSave: (updated: Entry[]) => void
  onClose: () => void
}

export default function DutyEditModal({ legs, entries, tz, onSave, onClose }: Props) {
  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]

  const s  = splitForEdit(firstLeg.showTime,    tz)
  const r  = splitForEdit(firstLeg.releaseTime, tz)

  const [showDate, setShowDate] = useState(s.d)
  const [showTime, setShowTime] = useState(s.t)
  const [relDate, setRelDate]   = useState(r.d)
  const [relTime, setRelTime]   = useState(r.t)
  const [offHobbs, setOffHobbs] = useState(firstLeg.offBlocks || '')
  const [onHobbs, setOnHobbs]   = useState(lastLeg.onBlocks || '')
  const [err, setErr]           = useState('')

  function handleSave() {
    setErr('')
    const offN = parseHobbs(offHobbs)
    const onN  = parseHobbs(onHobbs)
    if (offN === null || onN === null) { setErr('Hobbs Start and End are required.'); return }
    if (onN <= offN) { setErr('Hobbs End must be greater than Hobbs Start.'); return }
    const timeHint = localTimeHint(showDate, showTime, tz) ?? localTimeHint(relDate, relTime, tz)
    if (timeHint) { setErr(timeHint); return }
    const show    = localToUtcIso(showDate, showTime, tz)
    const release = localToUtcIso(relDate, relTime, tz)
    if (!show)    { setErr('Show Time is required.'); return }
    if (!release) { setErr('Release Time is required.'); return }
    if ((ms(release) ?? 0) <= (ms(show) ?? 0)) { setErr('Release Time must be after Show Time.'); return }
    if (overlappingDuty(entries, show, release, new Set(legs.map(l => l.id)))) {
      setErr('These times overlap another logged duty period. Check the Show and Release times.')
      return
    }

    const updated = legs.map((leg, i) => ({
      ...leg,
      showTime:    show,
      releaseTime: release,
      offBlocks:   i === 0               ? offHobbs.trim() : leg.offBlocks,
      onBlocks:    i === legs.length - 1 ? onHobbs.trim()  : leg.onBlocks,
    }))
    const legTimes = updated.map(l => hobbsFlightTime(parseHobbs(l.offBlocks), parseHobbs(l.onBlocks)))
    const badLeg = legTimes.findIndex(t => t === null || t <= 0)
    if (badLeg >= 0) { setErr(`Leg ${badLeg + 1}'s On Blocks Hobbs would not be greater than its Off Blocks. Check the Hobbs readings.`); return }
    if (flightExceedsDuty(show, release, legTimes.reduce<number>((s, t) => s + (t ?? 0), 0))) {
      setErr('Total flight time is longer than the duty period itself. Check the Hobbs readings and the Show/Release times.')
      return
    }

    onSave(updated)
  }

  const abbr = tzAbbr(tz, showDate)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Edit Duty Period</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500 -mt-1">
          {legs.length} legs — editing shared show/release times and first/last Hobbs readings.
          Expand legs to edit individual leg details.
        </p>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 py-2">
          <SectionLabel>Duty Period — times in {abbr}</SectionLabel>
          <DTField label="Show Time"    date={showDate} time={showTime} onDate={setShowDate} onTime={setShowTime} tz={tz} required />
          <DTField label="Release Time" date={relDate}  time={relTime}  onDate={setRelDate}  onTime={setRelTime}  tz={tz} required />

          <SectionLabel>Hobbs Readings</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Hobbs Start — Leg 1 Off Blocks <span className="text-red-500">*</span></Label>
            <Input type="number" value={offHobbs} onChange={e => setOffHobbs(e.target.value)} placeholder="12345.6" step="0.1" min="0" className="text-sm h-8" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Hobbs End — Leg {legs.length} On Blocks <span className="text-red-500">*</span></Label>
            <Input type="number" value={onHobbs} onChange={e => setOnHobbs(e.target.value)} placeholder="12349.0" step="0.1" min="0" className="text-sm h-8" />
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
