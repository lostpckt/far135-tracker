import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { parseDTPair, splitDT, ms } from '@/lib/calculations'
import type { Entry } from '@/types/entry'

interface Props {
  entry: Entry
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

function DTField({ label, date, time, onDate, onTime, placeholder = '00:00' }: {
  label: string; date: string; time: string
  onDate: (v: string) => void; onTime: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs font-semibold text-slate-500">{label}</Label>
      <div className="flex gap-1.5">
        <Input type="date" value={date} onChange={e => onDate(e.target.value)} className="text-sm h-8 flex-[1.5]" />
        <Input value={time} onChange={e => onTime(e.target.value)} placeholder={placeholder} maxLength={5} className="text-sm h-8 flex-1 min-w-0" />
      </div>
    </div>
  )
}

export default function EditModal({ entry, onSave, onClose }: Props) {
  const [pilot, setPilot]       = useState('')
  const [crew, setCrew]         = useState<'S' | 'D'>('S')
  const [showDate, setShowDate] = useState('')
  const [showTime, setShowTime] = useState('')
  const [relDate, setRelDate]   = useState('')
  const [relTime, setRelTime]   = useState('')
  const [dep, setDep]           = useState('')
  const [arr, setArr]           = useState('')
  const [offDate, setOffDate]   = useState('')
  const [offTime, setOffTime]   = useState('')
  const [onDate, setOnDate]     = useState('')
  const [onTime, setOnTime]     = useState('')
  const [rsDate, setRsDate]     = useState('')
  const [rsTime, setRsTime]     = useState('')
  const [reDate, setReDate]     = useState('')
  const [reTime, setReTime]     = useState('')
  const [reason, setReason]     = useState('')
  const [part91, setPart91]     = useState(false)
  const [restDay, setRestDay]   = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    setPilot(entry.pilot || '')
    setCrew(entry.crew || 'S')
    setReason(entry.reason || '')
    setPart91(!!entry.part91)
    setRestDay(!!entry.restDay)
    setDep(entry.dep || '')
    setArr(entry.arr || '')

    const s  = splitDT(entry.showTime);    setShowDate(s.d); setShowTime(s.t)
    const r  = splitDT(entry.releaseTime); setRelDate(r.d);  setRelTime(r.t)
    const of = splitDT(entry.offBlocks);   setOffDate(of.d); setOffTime(of.t)
    const on = splitDT(entry.onBlocks);    setOnDate(on.d);  setOnTime(on.t)
    const rs = splitDT(entry.restStart);   setRsDate(rs.d);  setRsTime(rs.t)
    const re = splitDT(entry.restEnd);     setReDate(re.d);  setReTime(re.t)
    setErr('')
  }, [entry])

  function handleSave() {
    setErr('')
    const off = parseDTPair(offDate, offTime)
    const on  = parseDTPair(onDate, onTime)

    if (!restDay) {
      if (!off || !on) { setErr('Off Blocks and On Blocks are required.'); return }
      if (ms(on)! <= ms(off)!) { setErr('On Blocks must be after Off Blocks.'); return }
      const show    = parseDTPair(showDate, showTime)
      const release = parseDTPair(relDate, relTime)
      if (show && release && ms(release)! <= ms(show)!) { setErr('Release Time must be after Show Time.'); return }
    }

    onSave({
      ...entry,
      pilot,
      crew,
      showTime:    parseDTPair(showDate, showTime),
      releaseTime: parseDTPair(relDate, relTime),
      dep:         dep.toUpperCase().trim(),
      arr:         arr.toUpperCase().trim(),
      offBlocks:   off,
      onBlocks:    on,
      restStart:   parseDTPair(rsDate, rsTime),
      restEnd:     parseDTPair(reDate, reTime),
      reason,
      part91,
      restDay,
    })
  }

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

          <SectionLabel>Duty Period</SectionLabel>
          <DTField label="Show Time (Duty Start)"    date={showDate} time={showTime} onDate={setShowDate} onTime={setShowTime} placeholder="14:30" />
          <DTField label="Release Time (Duty End)"   date={relDate}  time={relTime}  onDate={setRelDate}  onTime={setRelTime}  placeholder="22:15" />

          <SectionLabel>Flight Leg</SectionLabel>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Departure ICAO</Label>
            <Input value={dep} onChange={e => setDep(e.target.value.toUpperCase())} maxLength={4} className="text-sm h-8 uppercase" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Arrival ICAO</Label>
            <Input value={arr} onChange={e => setArr(e.target.value.toUpperCase())} maxLength={4} className="text-sm h-8 uppercase" />
          </div>
          <DTField label="Off Blocks" date={offDate} time={offTime} onDate={setOffDate} onTime={setOffTime} placeholder="09:00" />
          <DTField label="On Blocks"  date={onDate}  time={onTime}  onDate={setOnDate}  onTime={setOnTime}  placeholder="11:30" />

          <SectionLabel>Rest Period</SectionLabel>
          <DTField label="Rest Start" date={rsDate} time={rsTime} onDate={setRsDate} onTime={setRsTime} placeholder="23:00" />
          <DTField label="Rest End"   date={reDate} time={reTime} onDate={setReDate} onTime={setReTime} placeholder="09:00" />

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
            <div className="flex items-center gap-2">
              <Checkbox id="m-restday" checked={restDay} onCheckedChange={v => setRestDay(!!v)} />
              <label htmlFor="m-restday" className="text-sm cursor-pointer">24-hour rest day</label>
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
