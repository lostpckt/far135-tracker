import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import LegRow, { type LegData } from '@/components/LegRow'
import { uid, parseDTPair, ms, exportCSV, generateQuarterlyReport } from '@/lib/calculations'
import type { Entry } from '@/types/entry'

interface Props {
  entries: Entry[]
  onAdd: (updated: Entry[]) => void
}

function emptyLeg(): LegData {
  return { dep: '', arr: '', offDate: '', offTime: '', onDate: '', onTime: '', reason: '', part91: false }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full text-[0.68rem] font-bold uppercase tracking-widest text-slate-400 mt-2">
      {children}
    </div>
  )
}

export default function AddEntryForm({ entries, onAdd }: Props) {
  const [pilot, setPilot]       = useState('')
  const [crew, setCrew]         = useState<'S' | 'D'>('S')
  const [showDate, setShowDate] = useState('')
  const [showTime, setShowTime] = useState('')
  const [relDate, setRelDate]   = useState('')
  const [relTime, setRelTime]   = useState('')
  const [rsDate, setRsDate]     = useState('')
  const [rsTime, setRsTime]     = useState('')
  const [reDate, setReDate]     = useState('')
  const [reTime, setReTime]     = useState('')
  const [restDay, setRestDay]   = useState(false)
  const [legs, setLegs]         = useState<LegData[]>([emptyLeg()])
  const [err, setErr]           = useState('')

  const [rptQ, setRptQ]   = useState(Math.floor(new Date().getMonth() / 3).toString())
  const [rptY, setRptY]   = useState(new Date().getFullYear().toString())

  function resetForm() {
    setShowDate(''); setShowTime(''); setRelDate(''); setRelTime('')
    setRsDate(''); setRsTime(''); setReDate(''); setReTime('')
    setRestDay(false); setLegs([emptyLeg()]); setErr('')
  }

  function handleAdd() {
    setErr('')

    if (restDay) {
      if (!showDate) { setErr('For a rest day, enter the date in the Show Time date field.'); return }
      onAdd([...entries, { id: uid(), pilot, crew, showTime: `${showDate}T00:00`, releaseTime: '', dep: '', arr: '', offBlocks: '', onBlocks: '', restStart: '', restEnd: '', reason: '', part91: false, restDay: true }])
      resetForm()
      return
    }

    const show    = parseDTPair(showDate, showTime)
    const release = parseDTPair(relDate, relTime)
    if (show && release && ms(release)! <= ms(show)!) { setErr('Release Time must be after Show Time.'); return }

    const legData: { dep: string; arr: string; off: string; on: string; reason: string; part91: boolean }[] = []
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i]
      const off = parseDTPair(leg.offDate, leg.offTime)
      const on  = parseDTPair(leg.onDate,  leg.onTime)
      const label = legs.length > 1 ? `Leg ${i + 1}: ` : ''
      if (!off || !on) { setErr(`${label}Off Blocks and On Blocks are required.`); return }
      if (ms(on)! <= ms(off)!) { setErr(`${label}On Blocks must be after Off Blocks.`); return }
      legData.push({ dep: leg.dep, arr: leg.arr, off, on, reason: leg.reason, part91: leg.part91 })
    }

    const restStart = parseDTPair(rsDate, rsTime)
    const restEnd   = parseDTPair(reDate, reTime)

    const newEntries: Entry[] = legData.map(leg => ({
      id: uid(), pilot, crew,
      showTime: show, releaseTime: release,
      dep: leg.dep, arr: leg.arr,
      offBlocks: leg.off, onBlocks: leg.on,
      restStart, restEnd,
      reason: leg.reason, part91: leg.part91, restDay: false,
    }))

    onAdd([...entries, ...newEntries])
    resetForm()
  }

  function handleQuarterlyReport() {
    const q = parseInt(rptQ, 10)
    const y = parseInt(rptY, 10)
    if (isNaN(y) || y < 2000) { alert('Enter a valid year.'); return }
    const html = generateQuarterlyReport(entries, q, y)
    if (!html) {
      const labels = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)']
      alert(`No entries found for ${labels[q]} ${y}.`)
      return
    }
    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Add Flight Leg</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3.5">

          <SectionLabel>Identification</SectionLabel>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Pilot Name / ID</Label>
            <Input value={pilot} onChange={e => setPilot(e.target.value)} placeholder="e.g. J. Smith" className="text-sm h-8" />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Crew Configuration</Label>
            <Select value={crew} onValueChange={v => setCrew(v as 'S' | 'D')}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Single Pilot — 8 hr limit</SelectItem>
                <SelectItem value="D">Dual Pilot — 10 hr limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SectionLabel>Duty Period</SectionLabel>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Show Time (Duty Start)</Label>
            <div className="flex gap-1.5">
              <Input type="date" value={showDate} onChange={e => setShowDate(e.target.value)} className="text-sm h-8 flex-[1.5]" />
              <Input value={showTime} onChange={e => setShowTime(e.target.value)} placeholder="14:30" maxLength={5} className="text-sm h-8 flex-1 min-w-0" />
            </div>
            <span className="text-[0.68rem] text-slate-400">When you reported for duty (24-hr)</span>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Release Time (Duty End)</Label>
            <div className="flex gap-1.5">
              <Input type="date" value={relDate} onChange={e => setRelDate(e.target.value)} className="text-sm h-8 flex-[1.5]" />
              <Input value={relTime} onChange={e => setRelTime(e.target.value)} placeholder="22:15" maxLength={5} className="text-sm h-8 flex-1 min-w-0" />
            </div>
            <span className="text-[0.68rem] text-slate-400">When duty officially ended (24-hr)</span>
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
              onClick={() => setLegs([...legs, emptyLeg()])}
              className="w-full border border-dashed border-blue-300 bg-blue-50 hover:bg-blue-600 hover:text-white hover:border-solid text-blue-600 text-sm font-semibold rounded-lg py-2 mt-1 transition-colors"
            >
              + Add Another Leg
            </button>
          </div>

          <SectionLabel>Rest Period (After This Duty)</SectionLabel>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Rest Start</Label>
            <div className="flex gap-1.5">
              <Input type="date" value={rsDate} onChange={e => setRsDate(e.target.value)} className="text-sm h-8 flex-[1.5]" />
              <Input value={rsTime} onChange={e => setRsTime(e.target.value)} placeholder="23:00" maxLength={5} className="text-sm h-8 flex-1 min-w-0" />
            </div>
            <span className="text-[0.68rem] text-slate-400">When rest began after release (24-hr)</span>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-500">Rest End (Next Report / Wake-up)</Label>
            <div className="flex gap-1.5">
              <Input type="date" value={reDate} onChange={e => setReDate(e.target.value)} className="text-sm h-8 flex-[1.5]" />
              <Input value={reTime} onChange={e => setReTime(e.target.value)} placeholder="09:00" maxLength={5} className="text-sm h-8 flex-1 min-w-0" />
            </div>
          </div>

          <SectionLabel>Special Entries</SectionLabel>

          <div className="flex items-center gap-2 mt-1">
            <Checkbox id="f-restday" checked={restDay} onCheckedChange={v => setRestDay(!!v)} />
            <label htmlFor="f-restday" className="text-sm cursor-pointer">
              This was a 24-hour rest day (no duty or flights)
            </label>
          </div>

        </div>

        {err && <p className="text-red-600 text-xs mt-3">{err}</p>}

        <div className="flex flex-wrap gap-2.5 mt-4 items-center">
          <Button onClick={handleAdd} className="bg-slate-900 hover:bg-blue-600 text-sm h-8">
            Add Entry
          </Button>

          <Button variant="outline" onClick={() => exportCSV(entries)} className="text-green-700 border-green-200 bg-green-50 hover:bg-green-600 hover:text-white text-sm h-8">
            Export CSV
          </Button>

          <div className="flex items-center gap-2 ml-1">
            <Select value={rptQ} onValueChange={setRptQ}>
              <SelectTrigger className="text-sm h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Q1 (Jan–Mar)</SelectItem>
                <SelectItem value="1">Q2 (Apr–Jun)</SelectItem>
                <SelectItem value="2">Q3 (Jul–Sep)</SelectItem>
                <SelectItem value="3">Q4 (Oct–Dec)</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={rptY}
              onChange={e => setRptY(e.target.value)}
              min={2000}
              max={2099}
              className="text-sm h-8 w-[80px]"
            />
            <Button variant="outline" onClick={handleQuarterlyReport} className="text-blue-700 border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white text-sm h-8">
              Quarterly Report
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => { if (confirm('Delete ALL flight log entries? This cannot be undone.')) onAdd([]) }}
            className="text-red-600 border-red-200 bg-red-50 hover:bg-red-600 hover:text-white text-sm h-8"
          >
            Clear All Data
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
