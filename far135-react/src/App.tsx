import { useState, useEffect } from 'react'
import { loadEntries, saveEntries } from '@/lib/storage'
import { ms } from '@/lib/calculations'
import type { Entry } from '@/types/entry'
import Header from '@/components/Header'
import RegNote from '@/components/RegNote'
import Dashboard from '@/components/Dashboard'
import AddEntryForm from '@/components/AddEntryForm'
import FlightLog from '@/components/FlightLog'
import EditModal from '@/components/EditModal'
import QuickReference from '@/components/QuickReference'

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [dark, setDark] = useState(() => localStorage.getItem('far135_theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('far135_theme', dark ? 'dark' : 'light')
  }, [dark])

  function updateEntries(next: Entry[]) {
    const sorted = [...next].sort(
      (a, b) =>
        (ms(a.onBlocks) ?? ms(a.showTime) ?? 0) -
        (ms(b.onBlocks) ?? ms(b.showTime) ?? 0)
    )
    setEntries(sorted)
    saveEntries(sorted)
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950">
      <Header dark={dark} onToggleDark={() => setDark(d => !d)} />
      <div className="max-w-screen-2xl mx-auto p-5 space-y-5">
        <RegNote />
        <Dashboard entries={entries} />
        <AddEntryForm entries={entries} onAdd={updateEntries} />
        <FlightLog
          entries={entries}
          onEdit={setEditingEntry}
          onDelete={id => updateEntries(entries.filter(e => e.id !== id))}
        />
        <QuickReference />
      </div>

      {editingEntry && (
        <EditModal
          entry={editingEntry}
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
