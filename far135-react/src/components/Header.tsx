import { Moon, Sun } from 'lucide-react'

interface Props {
  dark: boolean
  onToggleDark: () => void
}

export default function Header({ dark, onToggleDark }: Props) {
  return (
    <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center gap-3">
      <div className="flex-1">
        <h1 className="text-lg font-bold">✈ FAR 135.267 Duty &amp; Flight Time Tracker</h1>
        <p className="text-xs opacity-60 mt-0.5">
          Part 135 Unscheduled Operations — Pilot Records | Data stored locally in your browser
        </p>
      </div>
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
