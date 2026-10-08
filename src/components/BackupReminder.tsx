import { useState, useEffect } from 'react'
import { HardDriveDownload } from 'lucide-react'
import { BACKUP_REMINDER_DAYS } from '@/lib/backup'

interface Props {
  entryCount: number
  lastBackup: number | null
  onBackup: () => void
}

// Browser storage can be cleared by Safari, a device reset, or deleting the
// home-screen app — a backup file saved outside the browser is the only copy
// that survives that. Nags until the backup is no older than BACKUP_REMINDER_DAYS.
export default function BackupReminder({ entryCount, lastBackup, onBackup }: Props) {
  // A home-screen app can stay open for days, so re-read the clock whenever it returns to the foreground.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (entryCount === 0) return null
  const days = lastBackup === null ? null : Math.floor((now - lastBackup) / 86_400_000)
  if (days !== null && days < BACKUP_REMINDER_DAYS) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <HardDriveDownload size={18} className="shrink-0 text-amber-600" />
      <p className="flex-1 min-w-[12rem] leading-snug">
        <strong>{days === null ? 'No backup yet.' : `Last backup was ${days} days ago.`}</strong>{' '}
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
