import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import ChangelogModal from '@/components/ChangelogModal'

interface Props {
  dark: boolean
  onToggleDark: () => void
}

export default function Header({ dark, onToggleDark }: Props) {
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)

  async function checkForUpdate() {
    setChecking(true)
    setChecked(false)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      await reg?.update()
    } finally {
      setChecking(false)
      setChecked(true)
      setTimeout(() => setChecked(false), 3000)
    }
  }

  return (
    <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center gap-3">
      <div className="flex-1">
        <h1 className="text-lg font-bold">✈ FAR 135.267 Duty &amp; Flight Time Tracker</h1>
        <p className="text-xs opacity-60 mt-0.5">
          Part 135 Unscheduled Operations — Pilot Records | Data stored locally in your browser
        </p>
      </div>
      <ChangelogModal>
        <button className="text-xs opacity-50 hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-slate-700">
          What's new
        </button>
      </ChangelogModal>
      <button
        onClick={checkForUpdate}
        disabled={checking}
        className="text-xs opacity-50 hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-slate-700 disabled:cursor-wait"
      >
        {checking ? 'Checking…' : checked ? 'Up to date' : 'Check for update'}
      </button>
      <button
        onClick={onToggleDark}
        className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
        title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  )
}
