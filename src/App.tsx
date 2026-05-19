import { useState, useEffect } from 'react'
import { loadEntries, saveEntries } from '@/lib/storage'
import { ms } from '@/lib/calculations'
import { loadTz, saveTz, isMigrated, setMigrated } from '@/lib/timezone'
import type { Entry } from '@/types/entry'
import Header from '@/components/Header'
import RegNote from '@/components/RegNote'
import Dashboard from '@/components/Dashboard'
import AddEntryForm from '@/components/AddEntryForm'
import FlightLog from '@/components/FlightLog'
import EditModal from '@/components/EditModal'
import QuickReference from '@/components/QuickReference'
import UpdateBanner from '@/components/UpdateBanner'
import InstallBanner from '@/components/InstallBanner'
import TzMigrationDialog from '@/components/TzMigrationDialog'

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [editingEntry, setEditingEntry]   = useState<Entry | null>(null)
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
        <Dashboard entries={entries} tz={tz} />
        <AddEntryForm entries={entries} onAdd={updateEntries} tz={tz} dark={dark} />
        <FlightLog
          entries={entries}
          tz={tz}
          onEdit={setEditingEntry}
          onDelete={id => updateEntries(entries.filter(e => e.id !== id))}
        />
        <QuickReference />
      </div>

      <UpdateBanner />

      {showMigration && (
        <TzMigrationDialog entries={entries} onComplete={handleMigrationComplete} />
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
