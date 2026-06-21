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
  const [type, setType]   = useState<'quarterly' | 'monthly'>('quarterly')
  const [quarter, setQuarter] = useState(() => Math.floor(new Date().getMonth() / 3).toString())
  const [month, setMonth]     = useState(() => new Date().getMonth().toString())
  const [year, setYear]       = useState(() => new Date().getFullYear().toString())

  function handleGenerate() {
    const y = parseInt(year, 10)
    if (isNaN(y) || y < 2000) { alert('Enter a valid year.'); return }

    let html: string
    if (type === 'quarterly') {
      const q = parseInt(quarter, 10)
      html = generateQuarterlyReport(entries, q, y, tz, dark)
      if (!html) { alert(`No entries found for ${['Q1 (Jan–Mar)','Q2 (Apr–Jun)','Q3 (Jul–Sep)','Q4 (Oct–Dec)'][q]} ${y}.`); return }
    } else {
      const m = parseInt(month, 10)
      html = generateMonthlyReport(entries, m, y, tz, dark)
      if (!html) { alert(`No entries found for ${MONTHS[m]} ${y}.`); return }
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
                <SelectContent>
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
                <SelectContent>
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
