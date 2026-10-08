import { useState, useEffect, useRef } from 'react'
import { loadEntries, saveEntries, runBulkValidationIfNeeded } from '@/lib/storage'
import { ms, exportCSV, importCSV, type SkippedRow } from '@/lib/calculations'
import { loadTz, saveTz, isMigrated, setMigrated } from '@/lib/timezone'
import { downloadBackup, parseBackup, lastBackupMs, requestPersistentStorage, type ParsedBackup } from '@/lib/backup'
import type { Entry } from '@/types/entry'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Header from '@/components/Header'
import RegNote from '@/components/RegNote'
import Dashboard from '@/components/Dashboard'
import AddEntryForm from '@/components/AddEntryForm'
import FlightLog from '@/components/FlightLog'
import EditModal from '@/components/EditModal'
import DutyEditModal from '@/components/DutyEditModal'
import QuickReference from '@/components/QuickReference'
import HowToUse from '@/components/HowToUse'
import UpdateBanner from '@/components/UpdateBanner'
import InstallBanner from '@/components/InstallBanner'
import BackupReminder from '@/components/BackupReminder'
import TzMigrationDialog from '@/components/TzMigrationDialog'
import RunReportDialog from '@/components/RunReportDialog'

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(() => {
    const loaded = loadEntries()
    return runBulkValidationIfNeeded(loaded) ?? loaded
  })
  const [editingEntry, setEditingEntry]   = useState<Entry | null>(null)
  const [editingDuty, setEditingDuty]     = useState<Entry[] | null>(null)
  const [showRunReport, setShowRunReport] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ entries: Entry[]; skipped: SkippedRow[] } | null>(null)
  const [pendingRestore, setPendingRestore] = useState<ParsedBackup | null>(null)
  const [importError, setImportError]     = useState<string | null>(null)
  const [lastBackup, setLastBackup]       = useState(lastBackupMs)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  useEffect(requestPersistentStorage, [])

  function readFile(e: React.ChangeEvent<HTMLInputElement>, onText: (text: string) => void) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => onText(ev.target?.result as string)
    reader.readAsText(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    readFile(e, text => {
      const result = importCSV(text)
      if ('error' in result) { setImportError(result.error); return }
      setPendingImport(result)
    })
  }

  function handleRestoreFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    readFile(e, text => {
      const result = parseBackup(text)
      if ('error' in result) { setImportError(result.error); return }
      setPendingRestore(result)
    })
  }

  function handleBackup() {
    if (!entries.length) { alert('No data to back up.'); return }
    downloadBackup(entries, tz).then(saved => { if (saved) setLastBackup(Date.now()) })
  }

  function confirmRestore(r: ParsedBackup) {
    updateEntries(r.entries)
    if (r.tz) handleTzChange(r.tz)
    // Backup entries are already stored in UTC — never offer the legacy tz migration on them.
    setMigrated()
    setShowMigration(false)
    setPendingRestore(null)
  }
  const [dark, setDark]                   = useState(() => localStorage.getItem('far135_theme') === 'dark')
  const [tz, setTz]                       = useState(loadTz)
  const [showMigration, setShowMigration] = useState(() => {
    if (isMigrated()) return false
    // No existing entries — nothing to migrate, mark done automatically.
    if (loadEntries().length === 0) { setMigrated(); return false }
    return true
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('far135_theme', dark ? 'dark' : 'light')
  }, [dark])

  function updateEntries(next: Entry[]) {
    const sorted = [...next].sort(
      (a, b) => (ms(a.showTime) ?? 0) - (ms(b.showTime) ?? 0)
    )
    setEntries(sorted)
    saveEntries(sorted)
  }

  function handleTzChange(newTz: string) {
    setTz(newTz)
    saveTz(newTz)
  }

  function handleMigrationComplete(migratedEntries: Entry[], chosenTz: string) {
    updateEntries(migratedEntries)
    handleTzChange(chosenTz)
    setMigrated()
    setShowMigration(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950">
      <Header dark={dark} onToggleDark={() => setDark(d => !d)} tz={tz} onTzChange={handleTzChange} />
      <div className="max-w-screen-2xl mx-auto p-5 space-y-5">
        <InstallBanner />
        <BackupReminder entryCount={entries.length} lastBackup={lastBackup} onBackup={handleBackup} />
        <RegNote />
        <HowToUse />
        <Dashboard entries={entries} tz={tz} />
        <AddEntryForm entries={entries} onAdd={updateEntries} tz={tz} />
        <FlightLog
          entries={entries}
          tz={tz}
          onEdit={setEditingEntry}
          onEditDuty={setEditingDuty}
          onDelete={id => updateEntries(entries.filter(e => e.id !== id))}
        />
        <div className="flex flex-wrap gap-2.5 items-center px-1">
          <button
            onClick={handleBackup}
            className="text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-600 hover:text-white text-sm h-8 px-3 rounded-md font-medium transition-colors"
          >
            Back Up Data
          </button>
          <button
            onClick={() => restoreInputRef.current?.click()}
            className="text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-600 hover:text-white text-sm h-8 px-3 rounded-md font-medium transition-colors"
          >
            Restore Backup
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleRestoreFileChange}
          />
          <button
            onClick={() => exportCSV(entries, tz)}
            className="text-green-700 border border-green-200 bg-green-50 hover:bg-green-600 hover:text-white text-sm h-8 px-3 rounded-md font-medium transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-green-700 border border-green-200 bg-green-50 hover:bg-green-600 hover:text-white text-sm h-8 px-3 rounded-md font-medium transition-colors"
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => setShowRunReport(true)}
            className="text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white text-sm h-8 px-3 rounded-md font-medium transition-colors"
          >
            Run Report
          </button>
        </div>
        <QuickReference />
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Danger Zone</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Permanently deletes all flight log entries. This cannot be undone.</p>
            </div>
            <button
              onClick={() => { if (confirm('Delete ALL flight log entries? This cannot be undone.')) updateEntries([]) }}
              className="text-red-600 border border-red-200 bg-red-50 hover:bg-red-600 hover:text-white text-sm h-8 px-3 rounded-md font-medium transition-colors whitespace-nowrap"
            >
              Clear All Data
            </button>
          </div>
        </div>
      </div>

      <UpdateBanner />

      {/* Import confirmation */}
      <Dialog open={!!pendingImport} onOpenChange={open => { if (!open) setPendingImport(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Import CSV?</DialogTitle></DialogHeader>
          {pendingImport && (() => {
            const flights  = pendingImport.entries.filter(e => !e.restDay).length
            const restDays = pendingImport.entries.filter(e => e.restDay).length
            const skipped  = pendingImport.skipped
            return (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Found <strong>{flights}</strong> flight {flights === 1 ? 'entry' : 'entries'} and <strong>{restDays}</strong> rest day {restDays === 1 ? 'row' : 'rows'}.
                </p>
                {skipped.length > 0 && (
                  <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    <p><strong>{skipped.length}</strong> {skipped.length === 1 ? 'row' : 'rows'} will <strong>not</strong> be imported:</p>
                    <ul className="mt-1 max-h-32 overflow-y-auto list-disc ml-4">
                      {skipped.map(s => <li key={s.line}>Line {s.line}: {s.reason}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  This will <strong>replace all existing data</strong>. Export your current log first if you want to keep it.
                </p>
              </div>
            )
          })()}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setPendingImport(null)}
              className="text-sm h-8 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (pendingImport) { updateEntries(pendingImport.entries); setPendingImport(null) } }}
              className="text-sm h-8 px-3 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
            >
              Replace &amp; Import
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <Dialog open={!!pendingRestore} onOpenChange={open => { if (!open) setPendingRestore(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Restore Backup?</DialogTitle></DialogHeader>
          {pendingRestore && (() => {
            const flights  = pendingRestore.entries.filter(e => !e.restDay).length
            const restDays = pendingRestore.entries.filter(e => e.restDay).length
            const made     = pendingRestore.exportedAt ? new Date(pendingRestore.exportedAt).toLocaleString() : 'unknown date'
            return (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Backup from <strong>{made}</strong> with <strong>{flights}</strong> flight {flights === 1 ? 'entry' : 'entries'} and <strong>{restDays}</strong> rest day {restDays === 1 ? 'entry' : 'entries'}.
                  {pendingRestore.tz && pendingRestore.tz !== tz && <> Timezone will change to <strong>{pendingRestore.tz}</strong>.</>}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  This will <strong>replace all existing data</strong>. Back up your current log first if you want to keep it.
                </p>
              </div>
            )
          })()}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setPendingRestore(null)}
              className="text-sm h-8 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { if (pendingRestore) confirmRestore(pendingRestore) }}
              className="text-sm h-8 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
            >
              Replace &amp; Restore
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import error */}
      <Dialog open={!!importError} onOpenChange={open => { if (!open) setImportError(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Import Failed</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">{importError}</p>
          <DialogFooter>
            <button
              onClick={() => setImportError(null)}
              className="text-sm h-8 px-3 rounded-md bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
            >
              OK
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RunReportDialog
        open={showRunReport}
        onClose={() => setShowRunReport(false)}
        entries={entries}
        tz={tz}
      />

      {showMigration && (
        <TzMigrationDialog entries={entries} onComplete={handleMigrationComplete} />
      )}

      {editingDuty && (
        <DutyEditModal
          legs={editingDuty}
          entries={entries}
          tz={tz}
          onSave={updatedLegs => {
            const updatedMap = new Map(updatedLegs.map(e => [e.id, e]))
            updateEntries(entries.map(e => updatedMap.get(e.id) ?? e))
            setEditingDuty(null)
          }}
          onClose={() => setEditingDuty(null)}
        />
      )}

      {editingEntry && (
        <EditModal
          key={editingEntry.id}
          entry={editingEntry}
          entries={entries}
          tz={tz}
          onSave={updated => {
            updateEntries(entries.map(e => e.id === updated.id ? updated : e))
            setEditingEntry(null)
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}
