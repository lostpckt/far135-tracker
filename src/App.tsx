import { useState, useEffect, useRef } from 'react'
import { loadEntries, saveEntries } from '@/lib/storage'
import { ms, exportCSV, importCSV } from '@/lib/calculations'
import { loadTz, saveTz, isMigrated, setMigrated } from '@/lib/timezone'
import type { Entry } from '@/types/entry'
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
import TzMigrationDialog from '@/components/TzMigrationDialog'
import RunReportDialog from '@/components/RunReportDialog'

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [editingEntry, setEditingEntry]   = useState<Entry | null>(null)
  const [editingDuty, setEditingDuty]     = useState<Entry[] | null>(null)
  const [showRunReport, setShowRunReport] = useState(false)
  const [pendingImport, setPendingImport] = useState<Entry[] | null>(null)
  const [importError, setImportError]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const result = importCSV(text)
      if ('error' in result) { setImportError(result.error); return }
      setPendingImport(result)
    }
    reader.readAsText(file)
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
      {pendingImport && (() => {
        const flights  = pendingImport.filter(e => !e.restDay).length
        const restDays = pendingImport.filter(e => e.restDay).length
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full space-y-4">
              <h2 className="text-base font-semibold">Import CSV?</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Found <strong>{flights}</strong> flight {flights === 1 ? 'entry' : 'entries'} and <strong>{restDays}</strong> rest day {restDays === 1 ? 'row' : 'rows'}.
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                This will <strong>replace all existing data</strong>. Export your current log first if you want to keep it.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setPendingImport(null)}
                  className="text-sm h-8 px-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { updateEntries(pendingImport); setPendingImport(null) }}
                  className="text-sm h-8 px-3 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                >
                  Replace &amp; Import
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Import error */}
      {importError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl p-6 mx-4 max-w-sm w-full space-y-4">
            <h2 className="text-base font-semibold text-red-600">Import Failed</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{importError}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setImportError(null)}
                className="text-sm h-8 px-3 rounded-md bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <RunReportDialog
        open={showRunReport}
        onClose={() => setShowRunReport(false)}
        entries={entries}
        tz={tz}
        dark={dark}
      />

      {showMigration && (
        <TzMigrationDialog entries={entries} onComplete={handleMigrationComplete} />
      )}

      {editingDuty && (
        <DutyEditModal
          legs={editingDuty}
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
