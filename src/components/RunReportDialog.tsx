import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateQuarterlyReport, generateMonthlyReport } from '@/lib/calculations'
import type { Entry } from '@/types/entry'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

interface Props {
  open: boolean
  onClose: () => void
  entries: Entry[]
  tz: string
  dark: boolean
}

export default function RunReportDialog({ open, onClose, entries, tz, dark }: Props) {
  const entities = [...new Set(
    entries.filter(e => !e.restDay && e.entity).map(e => e.entity!)
  )].sort()

  const [type, setType]       = useState<'quarterly' | 'monthly'>('quarterly')
  const [entity, setEntity]   = useState(() => entities.length === 1 ? entities[0] : '')
  const [quarter, setQuarter] = useState(() => Math.floor(new Date().getMonth() / 3).toString())
  const [month, setMonth]     = useState(() => new Date().getMonth().toString())
  const [year, setYear]       = useState(() => new Date().getFullYear().toString())

  function handleGenerate() {
    const y = parseInt(year, 10)
    if (isNaN(y) || y < 2000) { alert('Enter a valid year.'); return }
    if (!entity) { alert('Select an entity to generate the report for.'); return }

    let html: string
    if (type === 'quarterly') {
      const q = parseInt(quarter, 10)
      html = generateQuarterlyReport(entries, q, y, tz, dark, entity)
      if (!html) { alert(`No entries found for ${['Q1 (Jan–Mar)','Q2 (Apr–Jun)','Q3 (Jul–Sep)','Q4 (Oct–Dec)'][q]} ${y} — ${entity}.`); return }
    } else {
      const m = parseInt(month, 10)
      html = generateMonthlyReport(entries, m, y, tz, dark, entity)
      if (!html) { alert(`No entries found for ${MONTHS[m]} ${y} — ${entity}.`); return }
    }

    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Run Compliance Report</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Entity</label>
            {entities.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">No entities found. Add an entity to flight entries first.</p>
            ) : (
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger className="text-sm h-8 w-full">
                  <SelectValue placeholder="Select entity…" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {entities.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant={type === 'quarterly' ? 'default' : 'outline'}
              className="flex-1 text-sm h-9"
              onClick={() => setType('quarterly')}
            >
              Quarterly
            </Button>
            <Button
              variant={type === 'monthly' ? 'default' : 'outline'}
              className="flex-1 text-sm h-9"
              onClick={() => setType('monthly')}
            >
              Monthly
            </Button>
          </div>

          <div className="flex gap-2 items-center">
            {type === 'quarterly' ? (
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className="text-sm h-8 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="0">Q1 (Jan–Mar)</SelectItem>
                  <SelectItem value="1">Q2 (Apr–Jun)</SelectItem>
                  <SelectItem value="2">Q3 (Jul–Sep)</SelectItem>
                  <SelectItem value="3">Q4 (Oct–Dec)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="text-sm h-8 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              type="number"
              value={year}
              onChange={e => setYear(e.target.value)}
              min={2000}
              max={2099}
              className="text-sm h-8 w-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="text-sm h-8">Cancel</Button>
          <Button onClick={handleGenerate} className="text-sm h-8 bg-blue-600 hover:bg-blue-500 text-white">Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
