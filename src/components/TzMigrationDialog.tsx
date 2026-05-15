import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TIMEZONES, migrateEntries } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

interface Props {
  entries: Entry[]
  onComplete: (entries: Entry[], tz: string) => void
}

export default function TzMigrationDialog({ entries, onComplete }: Props) {
  const [step, setStep] = useState<'ask' | 'pick'>('ask')
  const [tz, setTz]     = useState('America/Anchorage')

  function handleAlreadyUtc() {
    onComplete(entries, 'UTC')
  }

  function handleMigrate() {
    onComplete(migrateEntries(entries, tz), tz)
  }

  return (
    <Dialog open>
      <DialogContent
        className="max-w-md"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold">One-time timezone setup</DialogTitle>
        </DialogHeader>

        {step === 'ask' ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your existing {entries.length} {entries.length === 1 ? 'entry' : 'entries'} don't have timezone
              information. Going forward, all times are stored as Zulu (UTC).
            </p>
            <p className="text-sm font-semibold">Were your previous entries recorded in local time or Zulu?</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setStep('pick')}
                className="bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 text-white text-sm h-9 justify-start"
              >
                They were local time — convert them
              </Button>
              <Button
                variant="outline"
                onClick={handleAlreadyUtc}
                className="text-sm h-9 justify-start"
              >
                They're already in Zulu / UTC
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Select the timezone your entries were recorded in. Each timestamp will be
              converted to the equivalent UTC time, including DST adjustments per entry date.
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500">Entry timezone</span>
              <Select value={tz} onValueChange={setTz}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.filter(t => t.value !== 'UTC').map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleMigrate}
                className="bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 text-white text-sm h-9"
              >
                Convert &amp; continue
              </Button>
              <Button variant="ghost" onClick={() => setStep('ask')} className="text-sm h-9">
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
