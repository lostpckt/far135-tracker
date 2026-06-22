import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ms, parseHobbs } from '@/lib/calculations'
import { localToUtcIso, utcToLocalParts, tzAbbr } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

interface Props {
  legs: Entry[]
  tz: string
  onSave: (updated: Entry[]) => void
  onClose: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full text-[0.68rem] font-bold uppercase tracking-widest text-slate-400 mt-2">
      {children}
    </div>
  )
}

function DTField({ label, date, time, onDate, onTime, tz }: {
  label: string; date: string; time: string
  onDate: (v: string) => void; onTime: (v: string) => void
  tz: string
}) {
  const utc = localToUtcIso(date, time, tz)
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-semibold text-slate-500">{label}</Label>
      <div className="flex gap-1.5">
        <Input type="date" value={date} onChange={e => onDate(e.target.value)} className="text-sm h-8 flex-[1.5] appearance-none" />
        <Input type="time" value={time} onChange={e => onTime(e.target.value)} className="text-sm h-8 flex-1 min-w-0 appearance-none" />
      </div>
      {utc && <span className="text-[0.68rem] text-blue-400">→ {utc.slice(11, 16)}Z on {utc.slice(5, 10)}</span>}
    </div>
  )
}

function splitForEdit(val: string, tz: string): { d: string; t: string } {
  if (!val) return { d: '', t: '' }
  if (val.endsWith('Z')) {
    const parts = utcToLocalParts(val, tz)
    return parts ? { d: parts.date, t: parts.time } : { d: '', t: '' }
  }
  const idx = val.indexOf('T')
  return idx >= 0 ? { d: val.slice(0, idx), t: val.slice(idx + 1) } : { d: val, t: '' }
}

export default function DutyEditModal({ legs, tz, onSave, onClose }: Props) {
  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]

  const s = splitForEdit(firstLeg.showTime, tz)
  const r = splitForEdit(firstLeg.releaseTime, tz)

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
    const show    = localToUtcIso(showDate, showTime, tz)
    const release = localToUtcIso(relDate, relTime, tz)
    if (!show)    { setErr('Show Time is required.'); return }
    if (!release) { setErr('Release Time is required.'); return }
    if ((ms(release) ?? 0) <= (ms(show) ?? 0)) { setErr('Release Time must be after Show Time.'); return }

    onSave(legs.map((leg, i) => ({
      ...leg,
      showTime:    show,
      releaseTime: release,
      offBlocks:   i === 0               ? offHobbs.trim() : leg.offBlocks,
      onBlocks:    i === legs.length - 1 ? onHobbs.trim()  : leg.onBlocks,
    })))
  }

  const abbr = tzAbbr(tz)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Edit Duty Period</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500 -mt-1">
          {legs.length} legs — editing shared show/release times and first/last Hobbs readings.
          Expand legs to edit individual leg details.
        </p>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 py-2">
          <SectionLabel>Duty Period — times in {abbr}</SectionLabel>
          <DTField label={`Show Time (${abbr})`}    date={showDate} time={showTime} onDate={setShowDate} onTime={setShowTime} tz={tz} />
          <DTField label={`Release Time (${abbr})`} date={relDate}  time={relTime}  onDate={setRelDate}  onTime={setRelTime}  tz={tz} />

          <SectionLabel>Hobbs Readings</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Hobbs Start — Leg 1 Off Blocks</Label>
            <Input type="number" value={offHobbs} onChange={e => setOffHobbs(e.target.value)} placeholder="12345.6" step="0.1" min="0" className="text-sm h-8" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Hobbs End — Leg {legs.length} On Blocks</Label>
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
