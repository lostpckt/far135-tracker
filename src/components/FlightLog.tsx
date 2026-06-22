import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, X, ChevronDown, ChevronRight } from 'lucide-react'
import { compute, computeDutyPeriod, fmtDT, fmtHrs } from '@/lib/calculations'
import { utcToLocalParts } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

interface Props {
  entries: Entry[]
  tz: string
  onEdit: (entry: Entry) => void
  onEditDuty: (legs: Entry[]) => void
  onDelete: (id: string) => void
}

function StatusBadge({ flag, okText, warnText }: { flag: boolean | null; okText: string; warnText: string }) {
  if (flag === null) return <Badge className="bg-slate-100 text-slate-400 text-[0.68rem]">N/A</Badge>
  return flag
    ? <Badge className="bg-green-50 text-green-700 text-[0.68rem]">✓ {okText}</Badge>
    : <Badge className="bg-red-50 text-red-700 text-[0.68rem]">⚠ {warnText}</Badge>
}

// Per-month user choices. Months with no entry use the default:
//   current month → open, past months → closed.
type MonthChoice = 'open' | 'closed'
const LS_KEY = 'far135_collapsed_months'

function readChoices(): Record<string, MonthChoice> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Migrate from old plain-array format
    if (Array.isArray(parsed)) {
      const choices: Record<string, MonthChoice> = {}
      for (const k of parsed as string[]) choices[k] = 'closed'
      return choices
    }
    return parsed as Record<string, MonthChoice>
  } catch { return {} }
}

function saveChoices(choices: Record<string, MonthChoice>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(choices))
  } catch { /* ignore */ }
}

function computeCollapsed(monthKeys: string[]): Set<string> {
  const currentKey = new Date().toISOString().slice(0, 7)
  const choices = readChoices()
  return new Set(
    monthKeys.filter(key => {
      if (choices[key] === 'open') return false
      if (choices[key] === 'closed') return true
      return key !== currentKey
    })
  )
}

function entryMonthKey(entry: Entry, tz: string): string {
  const anchor = entry.showTime || ''
  if (!anchor) return 'unknown'
  if (anchor.endsWith('Z')) {
    const parts = utcToLocalParts(anchor, tz)
    return parts ? parts.date.slice(0, 7) : anchor.slice(0, 7)
  }
  return anchor.slice(0, 7)
}

function monthLabel(key: string): string {
  if (key === 'unknown') return 'Unknown Date'
  return new Date(key + '-02T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// Groups entries within a month into duty periods and rest days.
type DutyItem = { type: 'duty'; key: string; legs: Entry[] }
type RestItem  = { type: 'rest';  entry: Entry }
type MonthItem = DutyItem | RestItem

function buildMonthItems(groupEntries: Entry[]): MonthItem[] {
  const items: MonthItem[] = []
  const seen = new Map<string, Entry[]>()
  for (const e of groupEntries) {
    if (e.restDay) {
      items.push({ type: 'rest', entry: e })
    } else {
      const key = `${e.showTime}|${e.releaseTime ?? ''}`
      if (!seen.has(key)) {
        const legs: Entry[] = []
        seen.set(key, legs)
        items.push({ type: 'duty', key, legs })
      }
      seen.get(key)!.push(e)
    }
  }
  return items
}

const COLS = 16

export default function FlightLog({ entries, tz, onEdit, onEditDuty, onDelete }: Props) {
  const [exceedanceReason, setExceedanceReason] = useState<string | null>(null)
  const [expandedDuty, setExpandedDuty] = useState<Set<string>>(new Set())

  const groups: { key: string; entries: Entry[] }[] = []
  for (const e of entries) {
    const key = entryMonthKey(e, tz)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.entries.push(e)
    else groups.push({ key, entries: [e] })
  }

  // Rest day entries with restDayEnd spanning into later months must appear in
  // each spanned month group so those months are visible in the log.
  for (const e of entries) {
    if (!e.restDay || !e.restDayEnd) continue
    const startKey = entryMonthKey(e, tz)
    const endKey = e.restDayEnd.slice(0, 7)
    if (endKey <= startKey) continue
    let [year, month] = startKey.split('-').map(Number)
    while (true) {
      month++
      if (month > 12) { month = 1; year++ }
      const key = `${year}-${String(month).padStart(2, '0')}`
      if (key > endKey) break
      const existing = groups.find(g => g.key === key)
      if (existing) {
        if (!existing.entries.includes(e)) existing.entries.unshift(e)
      } else {
        const insertIdx = groups.findIndex(g => g.key > key)
        if (insertIdx === -1) groups.push({ key, entries: [e] })
        else groups.splice(insertIdx, 0, { key, entries: [e] })
      }
    }
  }

  const groupsRef = useRef(groups)
  groupsRef.current = groups

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    computeCollapsed(groups.map(g => g.key))
  )

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setCollapsed(computeCollapsed(groupsRef.current.map(g => g.key)))
  }, [tz])

  const toggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const isCollapsed = prev.has(key)
      const next = new Set(prev)
      if (isCollapsed) next.delete(key)
      else next.add(key)
      const choices = readChoices()
      choices[key] = isCollapsed ? 'open' : 'closed'
      saveChoices(choices)
      return next
    })
  }, [])

  const toggleDuty = useCallback((key: string) => {
    setExpandedDuty(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  if (!entries.length) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Flight Log</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center py-12 text-slate-400">No entries yet — add your first flight leg above.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Flight Log</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                {['Show Time','Release Time','Crew','Route','Off Blocks','On Blocks','Leg Time','Rolling 24-hr','Flt OK?','Duty Period','Duty OK?','10-hr Lookback','Rest After','Rest OK?','Exceedance',''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 border-b-2 border-slate-200 dark:border-slate-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>

            {groups.map(({ key, entries: groupEntries }) => {
              const isMonthCollapsed = collapsed.has(key)
              const legCount  = groupEntries.filter(e => !e.restDay).length
              const restCount = groupEntries.filter(e => !!e.restDay).length
              const summary = [
                legCount  > 0 && `${legCount} leg${legCount !== 1 ? 's' : ''}`,
                restCount > 0 && `${restCount} rest day${restCount !== 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')

              return (
                <tbody key={key}>
                  {/* Month header row */}
                  <tr
                    onClick={() => toggle(key)}
                    className="cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 select-none"
                  >
                    <td colSpan={COLS} className="px-3 py-2 border-b border-slate-200 dark:border-slate-600">
                      <div className="flex items-center gap-2">
                        {isMonthCollapsed
                          ? <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
                          : <ChevronDown  size={14} className="text-slate-500 flex-shrink-0" />
                        }
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{monthLabel(key)}</span>
                        <span className="text-slate-400 text-[0.7rem]">{summary}</span>
                      </div>
                    </td>
                  </tr>

                  {!isMonthCollapsed && buildMonthItems(groupEntries).map(item => {
                    // ── Rest day row ──────────────────────────────────────────
                    if (item.type === 'rest') {
                      const e = item.entry
                      const anchor = e.showTime || ''
                      const localDate = anchor.endsWith('Z')
                        ? (utcToLocalParts(anchor, tz)?.date ?? anchor.slice(0, 10))
                        : anchor.slice(0, 10)
                      const localDateFmt = localDate.slice(5).replace('-', '/')
                      return (
                        <tr key={e.id} className="bg-green-50 dark:bg-green-950">
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">{localDateFmt}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">—</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-green-700 dark:text-green-400 font-semibold" colSpan={13}>
                            {e.restDayEnd && e.restDayEnd !== localDate
                              ? `🟢 24-HOUR REST DAYS: ${localDate} – ${e.restDayEnd}`
                              : '🟢 24-HOUR REST DAY — No flight duty'}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            <button onClick={() => onEdit(e)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 rounded p-1 mr-0.5"><Pencil size={13} /></button>
                            <button onClick={() => { if (confirm('Delete this entry?')) onDelete(e.id) }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded p-1"><X size={13} /></button>
                          </td>
                        </tr>
                      )
                    }

                    // ── Duty period ───────────────────────────────────────────
                    const { key: dutyKey, legs } = item
                    const isDutyExpanded = expandedDuty.has(dutyKey)

                    if (legs.length === 1) {
                      // Single-leg duty: render as a plain row (no toggle)
                      const e = legs[0]
                      const c = compute(e, entries, tz)
                      const excBadge = c.excAmt > 0
                        ? <button onClick={() => setExceedanceReason(e.reason || '(no reason recorded)')}><Badge className="bg-red-50 text-red-700 text-[0.68rem] cursor-pointer hover:bg-red-100">{fmtHrs(c.excAmt)}</Badge></button>
                        : <Badge className="bg-green-50 text-green-700 text-[0.68rem]">None</Badge>
                      const p91Badge = e.part91
                        ? <Badge className="bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[0.68rem] ml-1">Part 91</Badge>
                        : null
                      return (
                        <tr key={e.id} className={e.part91 ? 'bg-amber-50/40 dark:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{fmtDT(e.showTime)}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{e.releaseTime ? fmtDT(e.releaseTime) : <span className="text-slate-400">—</span>}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{e.crew === 'D' ? 'Dual' : 'Single'}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {(e.dep || '—').toUpperCase()} → {(e.arr || '—').toUpperCase()}{p91Badge}
                            {e.tailNumber && <div className="text-[0.65rem] text-slate-400">{e.tailNumber}</div>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{e.offBlocks || '—'}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{e.onBlocks || '—'}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 font-semibold whitespace-nowrap">{fmtHrs(c.legFlight)}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {e.part91
                              ? <span className="text-amber-600 dark:text-amber-400 text-[0.7rem]">Excluded (Part 91)</span>
                              : <><span className="font-semibold">{c.rolling24 !== null ? fmtHrs(c.rolling24) : '—'}</span><br /><span className="text-[0.68rem] text-slate-400">Limit: {c.maxFlight}h</span></>
                            }
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={e.part91 ? null : c.flightOk} okText="OK" warnText="EXCEEDED" /></td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{fmtHrs(c.dutyPeriod)}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                            <StatusBadge flag={e.part91 ? null : c.dutyOk} okText="OK" warnText="EXCEEDED" />
                            {!e.part91 && c.dutyOk === false && c.dutyPeriod !== null && (
                              <div className="text-[0.65rem] text-red-600 mt-0.5 whitespace-nowrap">+{fmtHrs(c.dutyPeriod - 14)} over · min {c.reqRest}h rest req'd</div>
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={e.part91 ? null : c.lookbackOk} okText="10-hr met" warnText="CHECK REST" /></td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {fmtHrs(c.consRest)}<br />
                            {!e.part91 && <span className="text-[0.68rem] text-slate-400">Req: {c.reqRest}h</span>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={e.part91 ? null : c.restOk} okText="OK" warnText="DEFICIENT" /></td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">{e.part91 ? <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-400 text-[0.68rem]">N/A</Badge> : excBadge}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            <button onClick={() => onEdit(e)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 rounded p-1 mr-0.5"><Pencil size={13} /></button>
                            <button onClick={() => { if (confirm('Delete this entry?')) onDelete(e.id) }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded p-1"><X size={13} /></button>
                          </td>
                        </tr>
                      )
                    }

                    // ── Multi-leg duty period ─────────────────────────────────
                    const { computedLegs, allPart91, totalFlight, rolling24, maxFlight, flightOk,
                            dutyPeriod, dutyOk, reqRest, lookbackOk, consRest, restOk, excAmt, excReason } =
                      computeDutyPeriod(legs, entries, tz)

                    const p91Count = legs.filter(l => l.part91).length
                    const p91Badge = p91Count > 0
                      ? <Badge className="bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[0.68rem] ml-1">{p91Count === legs.length ? 'Part 91' : `${p91Count} Part 91`}</Badge>
                      : null

                    const routeChain = [legs[0].dep, ...legs.map(l => l.arr)].filter(Boolean).map(s => s.toUpperCase()).join('→')

                    const summaryExcBadge = excAmt > 0
                      ? <button onClick={() => setExceedanceReason(excReason)}><Badge className="bg-red-50 text-red-700 text-[0.68rem] cursor-pointer hover:bg-red-100">{fmtHrs(excAmt)}</Badge></button>
                      : <Badge className="bg-green-50 text-green-700 text-[0.68rem]">None</Badge>

                    return (
                      <Fragment key={dutyKey}>
                        {/* Duty period summary row */}
                        <tr className={allPart91 ? 'bg-amber-50/40 dark:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => toggleDuty(dutyKey)}
                                className="text-slate-400 hover:text-blue-500 flex-shrink-0"
                              >
                                {isDutyExpanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                              </button>
                              {fmtDT(legs[0].showTime)}
                            </div>
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {legs[0].releaseTime ? fmtDT(legs[0].releaseTime) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {legs[0].crew === 'D' ? 'Dual' : 'Single'}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {routeChain}
                            <span className="text-slate-400 text-[0.65rem] ml-1">({legs.length} legs)</span>
                            {p91Badge}
                            {legs[0].tailNumber && <div className="text-[0.65rem] text-slate-400">{legs[0].tailNumber}</div>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{legs[0].offBlocks || '—'}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{legs[legs.length - 1].onBlocks || '—'}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 font-semibold whitespace-nowrap">{fmtHrs(totalFlight)}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {allPart91
                              ? <span className="text-amber-600 dark:text-amber-400 text-[0.7rem]">Excluded (Part 91)</span>
                              : <><span className="font-semibold">{rolling24 !== null ? fmtHrs(rolling24) : '—'}</span><br /><span className="text-[0.68rem] text-slate-400">Limit: {maxFlight}h</span></>
                            }
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={flightOk} okText="OK" warnText="EXCEEDED" /></td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{fmtHrs(dutyPeriod)}</td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                            <StatusBadge flag={dutyOk} okText="OK" warnText="EXCEEDED" />
                            {!allPart91 && dutyOk === false && dutyPeriod !== null && (
                              <div className="text-[0.65rem] text-red-600 mt-0.5 whitespace-nowrap">+{fmtHrs(dutyPeriod - 14)} over · min {reqRest}h rest req'd</div>
                            )}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={lookbackOk} okText="10-hr met" warnText="CHECK REST" /></td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            {fmtHrs(consRest)}<br />
                            {!allPart91 && <span className="text-[0.68rem] text-slate-400">Req: {reqRest}h</span>}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={restOk} okText="OK" warnText="DEFICIENT" /></td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                            {allPart91 ? <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-400 text-[0.68rem]">N/A</Badge> : summaryExcBadge}
                          </td>
                          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                            <button onClick={() => onEditDuty(legs)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 rounded p-1 mr-0.5"><Pencil size={13} /></button>
                            <button
                              onClick={() => toggleDuty(dutyKey)}
                              className="text-slate-400 hover:text-blue-500 rounded p-1"
                              title={isDutyExpanded ? 'Collapse legs' : 'Expand legs'}
                            >
                              {isDutyExpanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded per-leg rows */}
                        {isDutyExpanded && legs.map((e, legIdx) => {
                          const c = computedLegs[legIdx]
                          const excBadge = c.excAmt > 0
                            ? <button onClick={() => setExceedanceReason(e.reason || '(no reason recorded)')}><Badge className="bg-red-50 text-red-700 text-[0.68rem] cursor-pointer hover:bg-red-100">{fmtHrs(c.excAmt)}</Badge></button>
                            : <Badge className="bg-green-50 text-green-700 text-[0.68rem]">None</Badge>
                          return (
                            <tr key={e.id} className="bg-sky-50/30 dark:bg-sky-950/20">
                              <td className="pl-7 pr-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap text-slate-400 dark:text-slate-500">Leg {legIdx + 1}</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600">—</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600">—</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                                {(e.dep || '—').toUpperCase()} → {(e.arr || '—').toUpperCase()}
                                {e.part91 && <Badge className="bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[0.68rem] ml-1">Part 91</Badge>}
                                {e.tailNumber && <div className="text-[0.65rem] text-slate-400">{e.tailNumber}</div>}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{e.offBlocks || '—'}</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{e.onBlocks || '—'}</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 font-semibold whitespace-nowrap">{fmtHrs(c.legFlight)}</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                                {e.part91
                                  ? <span className="text-amber-600 dark:text-amber-400 text-[0.7rem]">Excluded (Part 91)</span>
                                  : <><span className="font-semibold">{c.rolling24 !== null ? fmtHrs(c.rolling24) : '—'}</span><br /><span className="text-[0.68rem] text-slate-400">Limit: {c.maxFlight}h</span></>
                                }
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={e.part91 ? null : c.flightOk} okText="OK" warnText="EXCEEDED" /></td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600">—</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600">—</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700"><StatusBadge flag={e.part91 ? null : c.lookbackOk} okText="10-hr met" warnText="CHECK REST" /></td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600">—</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600">—</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                                {e.part91 ? <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-400 text-[0.68rem]">N/A</Badge> : excBadge}
                              </td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                                <button onClick={() => onEdit(e)} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 rounded p-1 mr-0.5"><Pencil size={13} /></button>
                                <button onClick={() => { if (confirm('Delete this entry?')) onDelete(e.id) }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded p-1"><X size={13} /></button>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </tbody>
              )
            })}
          </table>
        </div>
      </CardContent>

      <Dialog open={exceedanceReason !== null} onOpenChange={open => { if (!open) setExceedanceReason(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exceedance Reason</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-700 dark:text-slate-300 py-2">{exceedanceReason}</p>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
