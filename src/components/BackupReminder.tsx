import { useState, useEffect } from 'react'
import { HardDriveDownload } from 'lucide-react'
import type { ReminderSetting } from '@/lib/backup'

interface Props {
  entryCount: number
  lastBackup: number | null
  newDuties: number            // duty entries added since the last backup
  reminder: ReminderSetting    // remind after this many days or new duty entries, whichever comes first
  onBackup: () => void
}

// Browser storage can be cleared by Safari, a device reset, or deleting the
// home-screen app — a backup file saved outside the browser is the only copy
// that survives that.
export default function BackupReminder({ entryCount, lastBackup, newDuties, reminder, onBackup }: Props) {
  // A home-screen app can stay open for days, so re-read the clock whenever it returns to the foreground.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (entryCount === 0) return null
  const days = lastBackup === null ? null : Math.floor((now - lastBackup) / 86_400_000)
  const dueByDays    = days === null || days >= reminder.days
  const dueByEntries = newDuties >= reminder.duties
  if (!dueByDays && !dueByEntries) return null

  const headline = days === null ? 'No backup yet.'
    : dueByEntries ? `${newDuties} new duty ${newDuties === 1 ? 'entry' : 'entries'} since your last backup.`
    : `Last backup was ${days} ${days === 1 ? 'day' : 'days'} ago.`

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <HardDriveDownload size={18} className="shrink-0 text-amber-600" />
      <p className="flex-1 min-w-[12rem] leading-snug">
        <strong>{headline}</strong>{' '}
        Your log is stored only in this browser and can be lost if it clears its data. Save a backup to Files or iCloud Drive.
      </p>
      <button
        onClick={onBackup}
        className="text-sm h-8 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors whitespace-nowrap"
      >
        Back Up Now
      </button>
    </div>
  )
}
