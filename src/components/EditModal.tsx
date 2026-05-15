import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ms, parseHobbs } from '@/lib/calculations'
import { localToUtcIso, utcToLocalParts, tzAbbr } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

interface Props {
  entry: Entry
  tz: string
  onSave: (updated: Entry) => void
  onClose: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full text-[0.68rem] font-bold uppercase tracking-widest text-slate-400 mt-2">
      {children}
    </div>
  )
}

function DTField({ label, date, time, onDate, onTime, placeholder = '00:00', tz }: {
  label: string; date: string; time: string
  onDate: (v: string) => void; onTime: (v: string) => void
  placeholder?: string; tz: string
}) {
  const utc = localToUtcIso(date, time, tz)
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-semibold text-slate-500">{label}</Label>
      <div className="flex gap-1.5">
        <Input type="date" value={date} onChange={e => onDate(e.target.value)} className="text-sm h-8 flex-[1.5] appearance-none" />
        <Input value={time} onChange={e => onTime(e.target.value)} placeholder={placeholder} maxLength={5} className="text-sm h-8 flex-1 min-w-0" />
      </div>
      {utc && <span className="text-[0.68rem] text-blue-400">→ {utc.slice(11, 16)}Z on {utc.slice(5, 10)}</span>}
    </div>
  )
}

export default function EditModal({ entry, tz, onSave, onClose }: Props) {
  const [pilot, setPilot]           = useState('')
  const [crew, setCrew]             = useState<'S' | 'D'>('S')
  const [showDate, setShowDate]     = useState('')
  const [showTime, setShowTime]     = useState('')
  const [relDate, setRelDate]       = useState('')
  const [relTime, setRelTime]       = useState('')
  const [dep, setDep]               = useState('')
  const [arr, setArr]               = useState('')
  const [offHobbs, setOffHobbs]     = useState('')
  const [onHobbs, setOnHobbs]       = useState('')
  const [rsDate, setRsDate]         = useState('')
  const [rsTime, setRsTime]         = useState('')
  const [reDate, setReDate]         = useState('')
  const [reTime, setReTime]         = useState('')
  const [reason, setReason]         = useState('')
  const [part91, setPart91]         = useState(false)
  const [restDay, setRestDay]       = useState(false)
  const [restDayEnd, setRestDayEnd] = useState('')
  const [err, setErr]               = useState('')

  // Split a stored timestamp (UTC or legacy local) into local date/time parts for editing.
  function splitForEdit(val: string): { d: string; t: string } {
    if (!val) return { d: '', t: '' }
    if (val.endsWith('Z')) {
      const parts = utcToLocalParts(val, tz)
      return parts ? { d: parts.date, t: parts.time } : { d: '', t: '' }
    }
    // Legacy entry without Z — split as-is
    const idx = val.indexOf('T')
    return idx >= 0 ? { d: val.slice(0, idx), t: val.slice(idx + 1) } : { d: val, t: '' }
  }

  useEffect(() => {
    setPilot(entry.pilot || '')
    setCrew(entry.crew || 'S')
    setReason(entry.reason || '')
    setPart91(!!entry.part91)
    setRestDay(!!entry.restDay)
    setRestDayEnd(entry.restDayEnd || '')
    setDep(entry.dep || '')
    setArr(entry.arr || '')
    setOffHobbs(entry.offBlocks || '')
    setOnHobbs(entry.onBlocks || '')

    const s  = splitForEdit(entry.showTime);    setShowDate(s.d); setShowTime(s.t)
    const r  = splitForEdit(entry.releaseTime); setRelDate(r.d);  setRelTime(r.t)
    const rs = splitForEdit(entry.restStart);   setRsDate(rs.d);  setRsTime(rs.t)
    const re = splitForEdit(entry.restEnd);     setReDate(re.d);  setReTime(re.t)
    setErr('')
  }, [entry]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    setErr('')

    if (restDay) {
      if (!showDate) { setErr('Enter a date in Show Time to assign this rest day to a quarter.'); return }
    } else {
      const offN = parseHobbs(offHobbs)
      const onN  = parseHobbs(onHobbs)
      if (offN === null || onN === null) { setErr('Off Blocks and On Blocks Hobbs readings are required.'); return }
      if (onN <= offN) { setErr('On Blocks Hobbs must be greater than Off Blocks Hobbs.'); return }
      const show    = localToUtcIso(showDate, showTime, tz)
      const release = localToUtcIso(relDate, relTime, tz)
      if (!show)    { setErr('Show Time is required.'); return }
      if (!release) { setErr('Release Time is required.'); return }
      if ((ms(release) ?? 0) <= (ms(show) ?? 0)) { setErr('Release Time must be after Show Time.'); return }
    }

    onSave({
      ...entry,
      pilot,
      crew,
      showTime:    restDay ? `${showDate}T00:00` : localToUtcIso(showDate, showTime, tz),
      releaseTime: restDay ? '' : localToUtcIso(relDate, relTime, tz),
      dep:         dep.toUpperCase().trim(),
      arr:         arr.toUpperCase().trim(),
      offBlocks:   offHobbs.trim(),
      onBlocks:    onHobbs.trim(),
      restStart:   localToUtcIso(rsDate, rsTime, tz),
      restEnd:     localToUtcIso(reDate, reTime, tz),
      reason,
      part91,
      restDay,
      restDayEnd: restDay && restDayEnd ? restDayEnd : undefined,
    })
  }

  const abbr = tzAbbr(tz)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Edit Flight Entry</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5 py-2">

          <SectionLabel>Identification</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Pilot Name / ID</Label>
            <Input value={pilot} onChange={e => setPilot(e.target.value)} className="text-sm h-8" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Crew Configuration</Label>
            <Select value={crew} onValueChange={v => setCrew(v as 'S' | 'D')}>
              <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Single Pilot — 8 hr limit</SelectItem>
                <SelectItem value="D">Dual Pilot — 10 hr limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SectionLabel>Duty Period — enter times in {abbr}</SectionLabel>
          <DTField label={`Show Time (${abbr})`}    date={showDate} time={showTime} onDate={setShowDate} onTime={setShowTime} placeholder="14:30" tz={tz} />
          <DTField label={`Release Time (${abbr})`} date={relDate}  time={relTime}  onDate={setRelDate}  onTime={setRelTime}  placeholder="22:15" tz={tz} />

          <SectionLabel>Flight Leg</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Departure ICAO</Label>
            <Input value={dep} onChange={e => setDep(e.target.value.toUpperCase())} maxLength={4} className="text-sm h-8 uppercase" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Arrival ICAO</Label>
            <Input value={arr} onChange={e => setArr(e.target.value.toUpperCase())} maxLength={4} className="text-sm h-8 uppercase" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Off Blocks (Hobbs)</Label>
            <Input type="number" value={offHobbs} onChange={e => setOffHobbs(e.target.value)} placeholder="12345.6" step="0.1" min="0" className="text-sm h-8" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">On Blocks (Hobbs)</Label>
            <Input type="number" value={onHobbs} onChange={e => setOnHobbs(e.target.value)} placeholder="12347.3" step="0.1" min="0" className="text-sm h-8" />
          </div>

          <SectionLabel>Rest Period — enter times in {abbr}</SectionLabel>
          <DTField label={`Rest Start (${abbr})`} date={rsDate} time={rsTime} onDate={setRsDate} onTime={setRsTime} placeholder="23:00" tz={tz} />
          <DTField label={`Rest End (${abbr})`}   date={reDate} time={reTime} onDate={setReDate} onTime={setReTime} placeholder="09:00" tz={tz} />

          <SectionLabel>Other</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Exceedance Reason</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Weather divert" className="text-sm h-8" />
          </div>

          <div className="flex flex-col gap-2 justify-end">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <Checkbox id="m-p91" checked={part91} onCheckedChange={v => setPart91(!!v)} />
              <label htmlFor="m-p91" className="text-xs font-semibold text-amber-800 cursor-pointer">
                Part 91 (exclude from 135 limits)
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="m-restday" checked={restDay} onCheckedChange={v => setRestDay(!!v)} />
                <label htmlFor="m-restday" className="text-sm cursor-pointer">24-hour rest day</label>
              </div>
              {restDay && (
                <div className="flex flex-col gap-1 ml-6">
                  <Label className="text-xs font-semibold text-slate-500">End Date (if multi-day)</Label>
                  <Input type="date" value={restDayEnd} onChange={e => setRestDayEnd(e.target.value)} className="text-sm h-8 w-44 appearance-none" />
                </div>
              )}
            </div>
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
