import { useState, useRef, useEffect } from 'react'
import { Moon, Sun, Menu, X, Globe, BookOpen, Sparkles, RefreshCw, Coffee, HardDriveDownload } from 'lucide-react'
import { REMINDER_DAY_CHOICES, REMINDER_DUTY_CHOICES, type ReminderSetting } from '@/lib/backup'
import ChangelogModal from '@/components/ChangelogModal'
import { HowToUseDialog } from '@/components/HowToUse'
import { tzOptions, tzAbbr } from '@/lib/timezone'
import { checkForAppUpdate } from '@/lib/updateCheck'

interface Props {
  dark: boolean
  onToggleDark: () => void
  tz: string
  onTzChange: (tz: string) => void
  needRefresh: boolean   // a new version is downloaded and waiting (UpdateBanner shows it)
  reminder: ReminderSetting
  onReminderChange: (r: ReminderSetting) => void
}

type CheckPhase = 'idle' | 'checking' | 'downloading' | 'upToDate' | 'failed'

// How long a result message stays up, and the most we'll show "Downloading…"
// before giving up on hearing back (the banner still appears whenever it's ready).
const RESULT_MS       = 3000
const DOWNLOAD_MAX_MS = 60000

const itemClass = 'w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors'

// Every header control lives in one menu at the far right, at every screen size.
export default function Header({ dark, onToggleDark, tz, onTzChange, needRefresh, reminder, onReminderChange }: Props) {
  const [phase, setPhase] = useState<CheckPhase>('idle')
  const [menuOpen, setMenuOpen] = useState(false)
  // The dialogs are rendered outside the menu so closing the menu doesn't close them.
  const [howToOpen, setHowToOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => () => clearTimeout(phaseTimer.current), [])

  // The header stays pinned to the top. Publish its height so in-page jumps
  // (scrollIntoView) stop below it instead of under it — see scroll-padding-top in index.css.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Show a phase, optionally returning to idle after `ms`.
  function showPhase(p: CheckPhase, ms?: number) {
    clearTimeout(phaseTimer.current)
    setPhase(p)
    if (ms) phaseTimer.current = setTimeout(() => setPhase('idle'), ms)
  }

  async function checkForUpdate() {
    showPhase('checking')
    const r = await checkForAppUpdate()
    if (r.kind === 'downloading') {
      // UpdateBanner takes over when the download finishes.
      showPhase('downloading', DOWNLOAD_MAX_MS)
      r.worker.addEventListener('statechange', () => {
        if (r.worker.state === 'redundant') showPhase('failed', RESULT_MS)
      })
    } else if (r.kind === 'waiting') {
      showPhase('idle')   // already downloaded; UpdateBanner is showing it
    } else {
      showPhase(r.kind, RESULT_MS)
    }
  }

  // Once an update is waiting, the banner speaks for it.
  const shown      = needRefresh ? 'idle' : phase
  const busy       = shown === 'checking' || shown === 'downloading'
  const checkLabel = { idle: 'Check for update', checking: 'Checking…', downloading: 'Downloading…', upToDate: 'Up to date', failed: "Couldn't check" }[shown]
  const toast      = {
    idle: null,
    checking: 'Checking for update…',
    downloading: 'Downloading update…',
    upToDate: <><span className="text-green-400">✓</span> Up to date</>,
    failed: "Couldn't check for updates — are you online?",
  }[shown]

  return (
    <>
    {toast && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-3 shadow-lg text-white text-sm font-medium pointer-events-none select-none">
        {toast}
      </div>
    )}
    <header ref={headerRef} className="sticky top-0 z-40 bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <h1 className="text-base sm:text-lg font-bold leading-tight">✈ FAR 135.267 Duty &amp; Flight Time Tracker</h1>
        <p className="text-xs opacity-60 mt-0.5">
          Part 135 Unscheduled Operations — Pilot Records | Data stored locally in your browser
        </p>
      </div>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-1.5 border border-slate-500 rounded-lg px-2.5 py-1.5 hover:bg-slate-700 transition-colors"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-72 z-50">
            <div className="px-4 pt-2 pb-3 border-b border-slate-700">
              <label htmlFor="home-tz" className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                <Globe size={13} className="opacity-60" />
                Home timezone ({tzAbbr(tz)})
              </label>
              <select
                id="home-tz"
                value={tz}
                onChange={e => onTzChange(e.target.value)}
                className="w-full rounded-md bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1.5"
              >
                {tzOptions(tz).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="text-[0.68rem] text-slate-400 mt-1.5 leading-snug">
                Sets where months and quarters begin, and shows the dashboard and older entries.
              </p>
            </div>

            <div className="px-4 pt-2.5 pb-3 border-b border-slate-700">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                <HardDriveDownload size={13} className="opacity-60" />
                Backup reminder
              </p>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-slate-400">Every</span>
                <select
                  aria-label="Remind after this many days"
                  value={reminder.days}
                  onChange={e => onReminderChange({ ...reminder, days: Number(e.target.value) })}
                  className="rounded-md bg-slate-700 border border-slate-600 text-white text-sm px-1.5 py-1"
                >
                  {REMINDER_DAY_CHOICES.map(d => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>)}
                </select>
                <span className="text-slate-400">or</span>
                <select
                  aria-label="Remind after this many new duty entries"
                  value={reminder.duties}
                  onChange={e => onReminderChange({ ...reminder, duties: Number(e.target.value) })}
                  className="rounded-md bg-slate-700 border border-slate-600 text-white text-sm px-1.5 py-1"
                >
                  {REMINDER_DUTY_CHOICES.map(n => <option key={n} value={n}>{n} entries</option>)}
                </select>
              </div>
              <p className="text-[0.68rem] text-slate-400 mt-1.5 leading-snug">Whichever comes first.</p>
            </div>

            <button onClick={onToggleDark} className={`${itemClass} border-b border-slate-700`}>
              {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
              {dark ? 'Light mode' : 'Dark mode'}
            </button>

            <button onClick={() => { setHowToOpen(true); setMenuOpen(false) }} className={itemClass}>
              <BookOpen size={16} className="opacity-70" />
              How to use
            </button>
            <button onClick={() => { setChangelogOpen(true); setMenuOpen(false) }} className={itemClass}>
              <Sparkles size={16} className="opacity-70" />
              What's new
            </button>
            <button
              onClick={() => { checkForUpdate(); setMenuOpen(false) }}
              disabled={busy}
              className={`${itemClass} disabled:cursor-wait`}
            >
              <RefreshCw size={16} className="opacity-70" />
              {checkLabel}
            </button>
            <a
              href="https://buymeacoffee.com/lostpckt"
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
              onClick={() => setMenuOpen(false)}
            >
              <Coffee size={16} className="opacity-70" />
              Buy me a coffee
            </a>
          </div>
        )}
      </div>
    </header>
    <HowToUseDialog open={howToOpen} onOpenChange={setHowToOpen} />
    <ChangelogModal open={changelogOpen} onOpenChange={setChangelogOpen} />
    </>
  )
}
