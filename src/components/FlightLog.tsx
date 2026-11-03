import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SECTION_CARD, SECTION_HEADER, SECTION_TITLE } from '@/lib/section'
import { Badge } from '@/components/ui/badge'
import ScrollX from '@/components/ScrollX'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Pencil, X, ChevronDown, ChevronRight } from 'lucide-react'
import { compute, computeDutyPeriod, dutyJoinNote, fmtHobbs, fmtHrs, fmtFlight, restPeriodsInWindow } from '@/lib/calculations'
import type { DutyComputed } from '@/lib/calculations'
import { utcToLocalParts, localYearMonth, monthStartMs, fmtLocalDT } from '@/lib/timezone'
import type { Entry, Computed } from '@/types/entry'

interface Props {
  entries: Entry[]
  tz: string
  onEdit: (entry: Entry) => void
  onEditDuty: (legs: Entry[]) => void
  onDelete: (id: string) => void
}

// Duty time; when breaks under 10 h join this to other duty entries, a line
// under it gives the whole duty period's start and its breaks.
function DutyTime({ hours, note }: { hours: number | null; note: string | null }) {
  return <>
    {fmtHrs(hours)}
    {note && <div className="text-[0.65rem] text-slate-500 dark:text-slate-400">{note}</div>}
  </>
}

// Rest after this entry. Mid-duty (another duty entry follows within 10 h)
// it was a break, not rest: "Same duty" and the break length.
function RestTime({ consRest, breakAfter, reqRest }: { consRest: number | null; breakAfter: number | null; reqRest: number | null }) {
  if (breakAfter !== null) return <>
    Same duty<br />
    <span className="text-[0.68rem] text-slate-400">{fmtHrs(breakAfter)} break</span>
  </>
  return <>
    {consRest !== null ? fmtHrs(consRest) : <span className="text-slate-400">In progress</span>}<br />
    {reqRest !== null && <span className="text-[0.68rem] text-slate-400">Req: {reqRest}h</span>}
  </>
}

const DASH_CELL = 'text-slate-300 dark:text-slate-600'

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

function computeCollapsed(monthKeys: string[], tz: string): Set<string> {
  const { year, monthIdx } = localYearMonth(tz)
  const currentKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`
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

// §135.267(f) rest periods (each full 24 h of rest) within a YYYY-MM month.
function restPeriodsInMonth(entries: Entry[], monthKey: string, tz: string, now: number): number {
  if (monthKey === 'unknown') return 0
  const [y, m] = monthKey.split('-').map(Number)
  return restPeriodsInWindow(entries, monthStartMs(y, m - 1, tz), monthStartMs(y, m, tz), now)
}

// Groups a month's legs into duty periods (legs sharing show and release).
function buildDutyPeriods(groupEntries: Entry[]): { key: string; legs: Entry[] }[] {
  const items: { key: string; legs: Entry[] }[] = []
  const seen = new Map<string, Entry[]>()
  for (const e of groupEntries) {
    const key = `${e.showTime}|${e.releaseTime ?? ''}`
    if (!seen.has(key)) {
      const legs: Entry[] = []
      seen.set(key, legs)
      items.push({ key, legs })
    }
    seen.get(key)!.push(e)
  }
  return items
}

// Flight time vs. its limit: under §135.267(c) the duty period's own flight
// time is limited; otherwise the (b) rolling 24-hour total.
function FlightLimitCell({ cQualifies, dutyFlight, rolling24, maxFlight }: { cQualifies: boolean | null; dutyFlight: number | null; rolling24: number | null; maxFlight: number }) {
  return cQualifies
    ? <><span className="font-semibold">{fmtHrs(dutyFlight)}</span><br /><span className="text-[0.68rem] text-slate-400">Duty period (c) · limit {maxFlight}h</span></>
    : <><span className="font-semibold">{rolling24 !== null ? fmtHrs(rolling24) : '—'}</span><br /><span className="text-[0.68rem] text-slate-400">24-hr window · limit {maxFlight}h</span></>
}

// What a duty row shows: computeDutyPeriod() for a multi-leg duty, or one
// leg's compute() put in the same shape (singleLegSummary).
type DutySummary = Omit<DutyComputed, 'computedLegs' | 'totalFlight' | 'reqRest'> & {
  totalFlight: number | null
  reqRest: number | null
}

function singleLegSummary(e: Entry, c: Computed): DutySummary {
  const p91 = e.part91
  return {
    ...c,
    allPart91:  p91,
    totalFlight: c.legFlight,
    // A Part 91 leg has no §135.267 results to show.
    flightOk:   p91 ? null : c.flightOk,
    dutyOk:     p91 ? null : c.dutyOk,
    lookbackOk: p91 ? null : c.lookbackOk,
    restOk:     p91 ? null : c.restOk,
    excReason:  e.reason || '(no reason recorded)',
  }
}

const TD = 'px-3 py-2 border-b border-slate-100 dark:border-slate-700'

// The row for one duty entry: a single-leg duty, or the summary row of a
// multi-leg one (with ▸ to show its legs, and the pencil editing the whole duty).
function DutyRow({ legs, d, note, tz, expanded, onToggle, onEdit, onDelete, onExceedance }: {
  legs: Entry[]
  d: DutySummary
  note: string | null
  tz: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onExceedance: (reason: string) => void
}) {
  const multi = legs.length > 1
  const first = legs[0]
  const p91Count = legs.filter(l => l.part91).length
  const p91Badge = p91Count > 0
    ? <Badge className="bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[0.68rem] ml-1">{p91Count === legs.length ? 'Part 91' : `${p91Count} Part 91`}</Badge>
    : null
  const excBadge = d.excAmt > 0
    ? <button onClick={() => onExceedance(d.excReason)}><Badge className="bg-red-50 text-red-700 text-[0.68rem] cursor-pointer hover:bg-red-100">{fmtHrs(d.excAmt)}</Badge></button>
    : <Badge className="bg-green-50 text-green-700 text-[0.68rem]">None</Badge>
  const chevron = expanded ? <ChevronDown size={13}/> : <ChevronRight size={13}/>

  return (
    <tr className={d.allPart91 ? 'bg-amber-50/40 dark:bg-amber-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}>
      <td className={`${TD} whitespace-nowrap`}>
        {multi
          ? <div className="flex items-center gap-1">
              <button onClick={onToggle} className="text-slate-400 hover:text-blue-500 flex-shrink-0">{chevron}</button>
              {fmtLocalDT(first.showTime, first.showTz ?? tz)}
            </div>
          : fmtLocalDT(first.showTime, first.showTz ?? tz)}
      </td>
      <td className={`${TD} whitespace-nowrap`}>{first.releaseTime ? fmtLocalDT(first.releaseTime, first.releaseTz ?? tz) : <span className="text-slate-400">—</span>}</td>
      <td className={`${TD} whitespace-nowrap`}>{first.crew === 'D' ? 'Dual' : 'Single'}</td>
      <td className={`${TD} whitespace-nowrap`}>
        {multi
          ? <>
              {[first.dep, ...legs.map(l => l.arr)].filter(Boolean).map(s => s.toUpperCase()).join('→')}
              <span className="text-slate-400 text-[0.65rem] ml-1">({legs.length} legs)</span>
            </>
          : <>{(first.dep || '—').toUpperCase()} → {(first.arr || '—').toUpperCase()}</>}
        {p91Badge}
        {first.tailNumber && <div className="text-[0.65rem] text-slate-400">{first.tailNumber}</div>}
      </td>
      <td className={`${TD} whitespace-nowrap`}>{fmtHobbs(first.offBlocks) || '—'}</td>
      <td className={`${TD} whitespace-nowrap`}>{fmtHobbs(legs[legs.length - 1].onBlocks) || '—'}</td>
      <td className={`${TD} font-semibold whitespace-nowrap`}>{fmtFlight(d.totalFlight).replace(/h$/, '')}</td>
      <td className={`${TD} whitespace-nowrap`}>
        {d.allPart91
          ? <span className="text-amber-600 dark:text-amber-400 text-[0.7rem]">Excluded (Part 91)</span>
          : <FlightLimitCell cQualifies={d.cQualifies} dutyFlight={d.dutyFlight} rolling24={d.rolling24} maxFlight={d.maxFlight} />
        }
      </td>
      <td className={TD}><StatusBadge flag={d.flightOk} okText="OK" warnText="EXCEEDED" /></td>
      <td className={`${TD} whitespace-nowrap`}><DutyTime hours={d.dutyPeriod} note={note} /></td>
      <td className={TD}>
        <StatusBadge flag={d.dutyOk} okText="OK" warnText="EXCEEDED" />
        {!d.allPart91 && d.dutyOk === false && d.dutyPeriod !== null && (
          <div className="text-[0.65rem] text-red-600 mt-0.5 whitespace-nowrap">+{fmtHrs(d.dutyPeriod - 14)} over · min {d.reqRest}h rest req'd</div>
        )}
      </td>
      <td className={TD}><StatusBadge flag={d.lookbackOk} okText="10-hr met" warnText="CHECK REST" /></td>
      <td className={`${TD} whitespace-nowrap`}>
        <RestTime consRest={d.consRest} breakAfter={d.breakAfter} reqRest={d.allPart91 ? null : d.reqRest} />
      </td>
      <td className={`${TD} ${d.breakAfter !== null ? DASH_CELL : ''}`}>{d.breakAfter !== null ? '—' : <StatusBadge flag={d.restOk} okText="OK" warnText="DEFICIENT" />}</td>
      <td className={TD}>{d.allPart91 ? <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-400 text-[0.68rem]">N/A</Badge> : excBadge}</td>
      <td className={`${TD} whitespace-nowrap`}>
        <button onClick={onEdit} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 rounded p-1 mr-0.5"><Pencil size={13} /></button>
        {multi
          ? <button onClick={onToggle} className="text-slate-400 hover:text-blue-500 rounded p-1" title={expanded ? 'Collapse legs' : 'Expand legs'}>{chevron}</button>
          : <button onClick={onDelete} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded p-1"><X size={13} /></button>}
      </td>
    </tr>
  )
}

const COLS = 16

export default function FlightLog({ entries, tz, onEdit, onEditDuty, onDelete }: Props) {
  const [exceedanceReason, setExceedanceReason] = useState<string | null>(null)
  const [expandedDuty, setExpandedDuty] = useState<Set<string>>(new Set())
  const [now] = useState(Date.now)

  // Legacy rest-day entries are kept in storage but no longer shown.
  const legs = entries.filter(e => !e.restDay)
  const groups: { key: string; entries: Entry[] }[] = []
  for (const e of legs) {
    const key = entryMonthKey(e, tz)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.entries.push(e)
    else groups.push({ key, entries: [e] })
  }

  const groupsRef = useRef(groups)
  useEffect(() => {
    groupsRef.current = groups
  })

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    computeCollapsed(groups.map(g => g.key), tz)
  )

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setCollapsed(computeCollapsed(groupsRef.current.map(g => g.key), tz))
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

  if (!legs.length) {
    return (
      <Card className={SECTION_CARD}>
        <CardHeader className={SECTION_HEADER}><CardTitle className={SECTION_TITLE}>Flight Log</CardTitle></CardHeader>
        <CardContent>
          <p className="text-center py-12 text-slate-400">No entries yet — add your first duty entry above.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${SECTION_CARD} overflow-clip`}>{/* clip, not hidden, so the scroll arrow can stay on screen (sticky) */}
      <CardHeader className={SECTION_HEADER}><CardTitle className={SECTION_TITLE}>Flight Log</CardTitle></CardHeader>
      <CardContent className="p-0">
        <ScrollX>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                {['Show Time','Release Time','Crew','Route','Off Blocks','On Blocks','Leg Time','Flight Time Limit','Flt OK?','Duty Period','Duty OK?','10-hr Lookback','Rest After','Rest OK?','Exceedance',''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 border-b-2 border-slate-200 dark:border-slate-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>

            {groups.map(({ key, entries: groupEntries }) => {
              const isMonthCollapsed = collapsed.has(key)
              const legCount  = groupEntries.length
              const restCount = restPeriodsInMonth(entries, key, tz, now)
              const summary = [
                `${legCount} leg${legCount !== 1 ? 's' : ''}`,
                restCount > 0 && `${restCount} rest period${restCount !== 1 ? 's' : ''} (24 h)`,
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

                  {!isMonthCollapsed && buildDutyPeriods(groupEntries).map(item => {
                    // ── Duty period ───────────────────────────────────────────
                    const { key: dutyKey, legs } = item
                    const isDutyExpanded = expandedDuty.has(dutyKey)

                    const multi = legs.length > 1
                    const dp = multi ? computeDutyPeriod(legs, entries) : null
                    const d = dp ?? singleLegSummary(legs[0], compute(legs[0], entries))
                    const row = (
                      <DutyRow
                        legs={legs} d={d} note={dutyJoinNote(d, legs[0], entries, tz)} tz={tz}
                        expanded={isDutyExpanded}
                        onToggle={() => toggleDuty(dutyKey)}
                        onEdit={() => multi ? onEditDuty(legs) : onEdit(legs[0])}
                        onDelete={() => { if (confirm('Delete this entry?')) onDelete(legs[0].id) }}
                        onExceedance={setExceedanceReason}
                      />
                    )
                    if (!dp) return <Fragment key={legs[0].id}>{row}</Fragment>
                    const { computedLegs } = dp

                    return (
                      <Fragment key={dutyKey}>
                        {row}

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
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{fmtHobbs(e.offBlocks) || '—'}</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">{fmtHobbs(e.onBlocks) || '—'}</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 font-semibold whitespace-nowrap">{fmtFlight(c.legFlight).replace(/h$/, '')}</td>
                              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 whitespace-nowrap">
                                {e.part91
                                  ? <span className="text-amber-600 dark:text-amber-400 text-[0.7rem]">Excluded (Part 91)</span>
                                  : <FlightLimitCell cQualifies={c.cQualifies} dutyFlight={c.dutyFlight} rolling24={c.rolling24} maxFlight={c.maxFlight} />
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
        </ScrollX>
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
