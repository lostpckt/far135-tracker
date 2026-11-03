// Rule math for §135.267. Section letters and numbers match the scenario list
// approved by the user on 2026-11-02. Unless stated: single pilot (8.0 h max),
// Part 135, times in UTC.
import { describe, it, expect, vi } from 'vitest'
import {
  parseHobbs, fmtHobbs, legTenths, fmtHrs, compute, computeDutyPeriod,
  overlappingDuty, flightExceedsDuty, restPeriodsInWindow, quarterRestCount,
  quarterFlightHours, twoQuarterFlightHours, annualFlightHours, nextLegalDutyMs,
  exportCSV, importCSV,
} from '@/lib/calculations'
import { at, duty, log, BASE, HOUR } from '@/lib/test-helpers'
import type { Entry } from '@/types/entry'

// exportCSV hands its text to saveFile (a download / share sheet); capture it instead.
const saved: string[] = []
vi.mock('@/lib/backup', () => ({
  saveFile: async (content: string) => { saved.push(content); return true },
}))

const last = (entries: Entry[]) => compute(entries.at(-1)!, entries)

describe('A. Hobbs readings and flight time', () => {
  it('1. Off 1234.5, On 1236.8 is 2.3 h', () => {
    expect(legTenths({ offBlocks: '1234.5', onBlocks: '1236.8' })).toBe(23)
    const [e] = duty(0, 4, [2.3])
    expect(compute(e, [e]).legFlight).toBe(2.3)
  })

  it('2. "12345" is accepted and saved as "12345.0"', () => {
    expect(parseHobbs('12345')).toBe(123450)
    expect(fmtHobbs('12345')).toBe('12345.0')
  })

  it('3. hundredths, letters and blanks are not Hobbs readings', () => {
    expect(parseHobbs('1234.56')).toBeNull()
    expect(parseHobbs('abc')).toBeNull()
    expect(parseHobbs('')).toBeNull()
  })

  it('4. On lower than Off counts no flight time', () => {
    expect(legTenths({ offBlocks: '1236.8', onBlocks: '1234.5' })).toBe(0)
    const [e] = duty(0, 4, [1], { offBlocks: '1236.8', onBlocks: '1234.5' })
    expect(compute(e, [e]).legFlight).toBeNull()
  })

  it('5. legs adding to exactly 8.0 h are at the limit: OK, not EXCEEDED', () => {
    // 12345.6 − 12343.3 is 2.2999999999992724 in floating point; tenths keep it exact.
    expect(legTenths({ offBlocks: '12343.3', onBlocks: '12345.6' })).toBe(23)
    const d = duty(0, 12, [2.3, 3.4, 2.3])
    const c = compute(d[2], d)
    expect(c.rolling24).toBe(8)
    expect(c.flightOk).toBe(true)
    expect(c.excAmt).toBe(0)
  })

  it('6. 1.9999 h shows "2h 00m", never "1h 60m"', () => {
    expect(fmtHrs(1.9999)).toBe('2h 00m')
    expect(fmtHrs(1.5)).toBe('1h 30m')
  })
})

describe('B. Rolling 24 hours, §135.267(b)', () => {
  it('7–8. a duty released 23 h 59 m earlier counts; exactly 24 h earlier does not', () => {
    const a = duty(0, 5, [4.0])
    const in24  = log(a, duty(15, 5 + 23 + 59 / 60, [4.1]))
    const out24 = log(a, duty(15, 5 + 24, [4.1]))
    expect(last(in24).rolling24).toBe(8.1)
    expect(last(out24).rolling24).toBe(4.1)
  })

  it('9. Part 91 legs never count toward the rolling 24 hours', () => {
    const d = duty(0, 12, [5.0, { flight: 3.0, part91: true }])
    expect(compute(d[0], d).rolling24).toBe(5)
  })

  it('10. 8.1 h single pilot, not under (c), is EXCEEDED by 0.1 h', () => {
    const l = log(duty(0, 5, [4.0]), duty(10, 15, [4.1]))   // only 5 h rest between: not (c)
    const c = last(l)
    expect(c.cQualifies).toBe(false)
    expect(c.rolling24).toBe(8.1)
    expect(c.flightOk).toBe(false)
    expect(c.excAmt).toBe(0.1)
  })

  it('11. dual pilot: 10.0 h OK, 10.1 h EXCEEDED', () => {
    const ok  = duty(0, 12, [10.0], { crew: 'D' })
    const bad = duty(0, 12, [10.1], { crew: 'D' })
    expect(compute(ok[0], ok).flightOk).toBe(true)
    expect(compute(bad[0], bad).flightOk).toBe(false)
  })

  it('12. a duty ending in a Part 91 leg still carries the Part 135 rolling total', () => {
    const d = duty(0, 12, [3.0, 2.0, { flight: 1.5, part91: true }])
    const dp = computeDutyPeriod(d, d)
    expect(compute(d[2], d).rolling24).toBe(5)
    expect(dp.rolling24).toBe(5)
  })
})

describe('C. §135.267(c), a duty judged on its own flight time', () => {
  // A: 0–6 with 4.0 h. B: 10 h rest, then a 12 h duty with 7.5 h. C: 10 h rest after B.
  // B's rolling 24 h includes A (11.5 h), but under (c) only B's own 7.5 h is limited.
  const A = () => duty(0, 6, [4.0])
  const C = (from: number) => duty(from, from + 4, [1.0])

  it('13. 12 h duty, 10 h rest before and after, 7.5 h flight: qualifies; flight OK', () => {
    const B = duty(16, 28, [7.5])
    const l = log(A(), B, C(38))
    const c = compute(B[0], l)
    expect(c.rolling24).toBe(11.5)
    expect(c.cQualifies).toBe(true)
    expect(c.flightOk).toBe(true)
    expect(c.excAmt).toBe(0)
  })

  it('14. a 14 h 01 m duty does not qualify; (b) applies', () => {
    const B = duty(16, 16 + 14 + 1 / 60, [7.5])
    const c = compute(B[0], log(A(), B, C(16 + 14 + 1 / 60 + 10)))
    expect(c.cQualifies).toBe(false)
    expect(c.dutyOk).toBe(false)
    // A (released at 6) is just outside B's 24 h window (6:01–30:01), so (b) sees 7.5 h.
    expect(c.rolling24).toBe(7.5)
    expect(c.flightOk).toBe(true)
  })

  it('15. rest before of 9 h 59 m does not qualify', () => {
    const B = duty(15 + 59 / 60, 27, [7.5])
    expect(compute(B[0], log(A(), B, C(37))).cQualifies).toBe(false)
  })

  it('16. rest after of 9 h 59 m does not qualify', () => {
    const B = duty(16, 28, [7.5])
    expect(compute(B[0], log(A(), B, C(37 + 59 / 60))).cQualifies).toBe(false)
  })

  it('17. latest duty, next not logged yet: counts as followed by rest for now', () => {
    const B = duty(16, 28, [7.5])
    expect(compute(B[0], log(A(), B)).cQualifies).toBe(true)
  })

  it('18. first duty ever logged (rest before unknown) does not qualify', () => {
    const B = duty(16, 28, [7.5])
    expect(compute(B[0], B).cQualifies).toBe(false)
  })

  it('19. own flight of 8.1 h single pilot does not qualify; (b) applies', () => {
    const B = duty(16, 28, [8.1])
    const c = compute(B[0], log(A(), B, C(38)))
    expect(c.cQualifies).toBe(false)
    expect(c.flightOk).toBe(false)
  })

  it('20. (c)(3) is the 14 h duty / 10 h rest pattern: exactly 14 h and exactly 10 h qualify', () => {
    const B = duty(16, 30, [7.5])
    expect(compute(B[0], log(A(), B, C(40))).cQualifies).toBe(true)
  })
})

describe('D. Exceedance → required rest, §135.267(e)', () => {
  // A first logged duty can't use (c), so its flight is judged on (b).
  const reqRest = (flight: number) => { const d = duty(0, 12, [flight]); return compute(d[0], d).reqRest }

  it('21. no exceedance: 10 h', () => expect(reqRest(8.0)).toBe(10))
  it('22. over by 0.1 h and by exactly 0.5 h: 11 h', () => {
    expect(reqRest(8.1)).toBe(11)
    expect(reqRest(8.5)).toBe(11)
  })
  it('23. over by 0.6 h and by exactly 1.0 h: 12 h', () => {
    expect(reqRest(8.6)).toBe(12)
    expect(reqRest(9.0)).toBe(12)
  })
  it('24. over by 1.1 h: 16 h', () => expect(reqRest(9.1)).toBe(16))

  it('25. 11.9 h rest when 12 h is needed is DEFICIENT; exactly 12.0 h is OK', () => {
    const a = duty(0, 12, [8.6])
    const short = log(a, duty(12 + 11.9, 30, [1.0]))
    const exact = log(a, duty(24, 30, [1.0]))
    expect(compute(a[0], short).restOk).toBe(false)
    expect(compute(a[0], exact).restOk).toBe(true)
  })

  it('26. the duty reports the Exceedance Reason from its exceeding leg', () => {
    const d = duty(0, 12, [4.0, { flight: 4.6, reason: 'Weather diversion' }])
    const dp = computeDutyPeriod(d, d)
    expect(dp.excAmt).toBe(0.6)
    expect(dp.excReason).toBe('Weather diversion')
  })
})

describe('E. 10-hour look-back, §135.267(d)', () => {
  it('27. 10+ h of unbroken rest inside the 24 h before release: OK', () => {
    const l = log(duty(0, 2, [1.0]), duty(14, 20, [1.0]))
    expect(last(l).lookbackOk).toBe(true)
  })

  it('28. a 12 h rest with only 9 h inside the window: CHECK', () => {
    // Rest 0–12; second duty 12–27, so the window is 3–27 and holds 9 h of that rest.
    const l = log(duty(-10, 0, [1.0]), duty(12, 27, [1.0]))
    expect(last(l).lookbackOk).toBe(false)
  })

  it('29. window reaching back before the first logged duty: N/A', () => {
    const d = duty(0, 6, [1.0])
    expect(compute(d[0], d).lookbackOk).toBeNull()
  })

  it('30. two separate rests of 6 h and 5 h: CHECK (must be unbroken)', () => {
    // Window for the last duty is −2 to 22. Rests −1–5 (6 h) and 9–14 (5 h).
    const l = log(duty(-12, -1, [1.0]), duty(5, 9, [1.0]), duty(14, 22, [1.0]))
    expect(last(l).lookbackOk).toBe(false)
  })
})

describe('F. Duty periods and rest', () => {
  it('31. legs with the same Show and Release are one duty period', () => {
    const d = duty(0, 10, [2.0, 3.0])
    expect(compute(d[0], d).dutyFlight).toBe(5)
    expect(compute(d[1], d).dutyFlight).toBe(5)
  })

  it('32. rest runs from Release to the next Show; a Part 91 duty ends it too', () => {
    const a = duty(0, 5, [2.0])
    const l = log(a, duty(10, 12, [{ flight: 1.0, part91: true }]))
    expect(compute(a[0], l).consRest).toBe(5)
    expect(compute(a[0], l).restOk).toBe(false)
  })

  it('33. any Part 135 duty over 14 h is Duty EXCEEDED (strict reading); 14 h exactly is OK', () => {
    const over = duty(0, 14 + 1 / 60, [2.0])
    const exact = duty(0, 14, [2.0])
    expect(compute(over[0], over).dutyOk).toBe(false)
    expect(compute(exact[0], exact).dutyOk).toBe(true)
  })

  it('34. a duty that overlaps another is refused; back-to-back or the same duty is not', () => {
    const l = duty(0, 10, [2.0])
    expect(overlappingDuty(l, at(9), at(15), new Set())).toBe(true)
    expect(overlappingDuty(l, at(10), at(15), new Set())).toBe(false)
    expect(overlappingDuty(l, at(0), at(10), new Set())).toBe(false)
    expect(overlappingDuty(l, at(9), at(15), new Set([l[0].id]))).toBe(false)   // editing that duty
  })

  it('35. flight time longer than the duty is a data-entry error', () => {
    expect(flightExceedsDuty(at(0), at(2), 21)).toBe(true)
    expect(flightExceedsDuty(at(0), at(2), 20)).toBe(false)
  })

  it('36. Duty OK on a day ending with a Part 91 leg comes from the last Part 135 leg', () => {
    const d = duty(0, 13, [3.0, { flight: 1.0, part91: true }])
    expect(compute(d[1], d).dutyOk).toBeNull()
    expect(computeDutyPeriod(d, d).dutyOk).toBe(true)
  })
})

describe('G. Rest periods per quarter, §135.267(f)', () => {
  const restOf = (h: number) => restPeriodsInWindow(log(duty(0, 5, [1.0]), duty(5 + h, 5 + h + 4, [1.0])), BASE - 1000 * HOUR, BASE + 1000 * HOUR)

  it('37. 24 h rest is 1; 47 h 59 m is 1; 48 h is 2 (current reading, pending operator)', () => {
    expect(restOf(24)).toBe(1)
    expect(restOf(47 + 59 / 60)).toBe(1)
    expect(restOf(48)).toBe(2)
    expect(restOf(23 + 59 / 60)).toBe(0)
  })

  it('38. a 30 h rest split 15/15 by the quarter boundary counts in neither quarter (strict, option A)', () => {
    const q2 = '2026-04-01T00:00Z'
    const l = log(duty('2026-03-31T05:00Z', '2026-03-31T09:00Z', [1.0]), duty('2026-04-02T00:00Z', '2026-04-02T04:00Z', [1.0]))
    // release 03-31 09:00Z → show 04-02 00:00Z is 39 h; 15 h falls in Q1, 24 h in Q2.
    expect(quarterRestCount(l, 0, 2026, 'UTC')).toBe(0)
    expect(quarterRestCount(l, 1, 2026, 'UTC')).toBe(1)
    const split = log(duty('2026-03-31T05:00Z', '2026-03-31T09:00Z', [1.0]), duty('2026-04-01T15:00Z', '2026-04-01T19:00Z', [1.0]))
    expect(Date.parse(q2) - Date.parse('2026-03-31T09:00Z')).toBe(15 * HOUR)
    expect(quarterRestCount(split, 0, 2026, 'UTC')).toBe(0)
    expect(quarterRestCount(split, 1, 2026, 'UTC')).toBe(0)
  })

  it('39. time off since the last release, still in progress, counts', () => {
    const l = duty(0, 5, [1.0])
    expect(restPeriodsInWindow(l, BASE - 100 * HOUR, BASE + 100 * HOUR)).toBe(0)
    expect(restPeriodsInWindow(l, BASE - 100 * HOUR, BASE + 100 * HOUR, BASE + 30 * HOUR)).toBe(1)
  })

  it('40. counts 13 separate 24 h rests in a quarter', () => {
    // 13 duties, each followed by 30 h off.
    const l = log(...Array.from({ length: 14 }, (_, i) => duty(i * 34, i * 34 + 4, [1.0])))
    expect(restPeriodsInWindow(l, BASE, BASE + 90 * 24 * HOUR)).toBe(13)
  })
})

describe('H. Quarter, two-quarter and year totals, §135.267(a)', () => {
  it('41. 500 h of legs totals exactly 500 (no rounding creep at the limit)', () => {
    // 50 duties of 10.0 h made of 2.3 / 3.4 / 2.3 / 2.0 legs, all in Q1 2026.
    const l = log(...Array.from({ length: 50 }, (_, i) => duty(i * 30, i * 30 + 12, [2.3, 3.4, 2.3, 2.0], { crew: 'D' })))
    expect(quarterFlightHours(l, 0, 2026, 'UTC')).toBe(500)
    expect(quarterFlightHours(l, 0, 2026, 'UTC') > 500).toBe(false)
  })

  it('42. a leg counts in the quarter of its release in the home timezone', () => {
    // Released 11:30 pm Mar 31 in Denver (MDT) = Apr 1 05:30Z.
    const l = duty('2026-03-31T15:00Z', '2026-04-01T05:30Z', [3.0])
    expect(quarterFlightHours(l, 0, 2026, 'America/Denver')).toBe(3)
    expect(quarterFlightHours(l, 1, 2026, 'America/Denver')).toBe(0)
    expect(quarterFlightHours(l, 0, 2026, 'UTC')).toBe(0)   // in Zulu it would be Q2
    // Released exactly at local midnight Apr 1 (06:00Z) belongs to Q2, not Q1.
    const edge = duty('2026-03-31T20:00Z', '2026-04-01T06:00Z', [2.0])
    expect(quarterFlightHours(edge, 1, 2026, 'America/Denver')).toBe(2)
    expect(quarterFlightHours(edge, 0, 2026, 'America/Denver')).toBe(0)
  })

  it('43. the two-quarter total for Q1 includes last year’s Q4', () => {
    const l = log(duty('2026-11-10T12:00Z', '2026-11-10T20:00Z', [4.0]), duty('2027-02-10T12:00Z', '2027-02-10T20:00Z', [3.0]))
    expect(twoQuarterFlightHours(l, 0, 2027, 'UTC')).toBe(7)
    expect(annualFlightHours(l, 2027, 'UTC')).toBe(3)
  })

  it('44. Part 91 hours are left out of the 500/800/1,400 totals', () => {
    const l = duty('2026-02-10T12:00Z', '2026-02-10T20:00Z', [4.0, { flight: 2.0, part91: true }])
    expect(quarterFlightHours(l, 0, 2026, 'UTC')).toBe(4)
    expect(annualFlightHours(l, 2026, 'UTC')).toBe(4)
  })
})

describe('I. Next Legal Duty', () => {
  it('45a. last Part 135 release + 10 h with no exceedance', () => {
    expect(nextLegalDutyMs(duty(0, 12, [6.0]))).toBe(BASE + 22 * HOUR)
  })

  it('45b. last Part 135 release + its required rest after an exceedance (0.6 h → 12 h)', () => {
    expect(nextLegalDutyMs(duty(0, 12, [8.6]))).toBe(BASE + 24 * HOUR)
  })

  it('45c. a later Part 91 duty pushes it to that release + 10 h', () => {
    const l = log(duty(0, 12, [6.0]), duty(14, 17, [{ flight: 1.0, part91: true }]))
    expect(nextLegalDutyMs(l)).toBe(BASE + 27 * HOUR)
  })

  it('45d. a trailing Part 91 leg does not replace the Part 135 required rest', () => {
    const l = duty(0, 12, [8.6, { flight: 0.5, part91: true }])
    expect(nextLegalDutyMs(l)).toBe(BASE + 24 * HOUR)
  })

  it('45e. nothing logged, or only Part 91: no time shown', () => {
    expect(nextLegalDutyMs([])).toBeNull()
    expect(nextLegalDutyMs(duty(0, 4, [{ flight: 1.0, part91: true }]))).toBeNull()
  })
})

describe('J. Daylight saving in rest', () => {
  it('48. a rest across fall-back is measured in real hours: 8 pm to 8 am is 13 h', () => {
    // New York, Oct 31 2026 20:00 EDT = Nov 1 00:00Z; Nov 1 08:00 EST = 13:00Z.
    const a = duty('2026-10-31T14:00Z', '2026-11-01T00:00Z', [2.0])
    const l = log(a, duty('2026-11-01T13:00Z', '2026-11-01T18:00Z', [2.0]))
    expect(compute(a[0], l).consRest).toBe(13)
  })
})

describe('K. CSV export and import', () => {
  it('51. an exported CSV imports back to the same duties and legs', async () => {
    const l = log(
      duty(0, 12, [2.3, { flight: 1.4, part91: true }], { showTz: 'America/Denver', releaseTz: 'America/Chicago', entity: 'Acme Air' }),
      duty(30, 40, [3.0, { flight: 4.6, reason: 'ATC hold' }], { crew: 'D' }),
    )
    exportCSV(l)
    await Promise.resolve()
    const r = importCSV(saved.at(-1)!)
    if ('error' in r) throw new Error(r.error)
    expect(r.skipped).toEqual([])
    const strip = (e: Entry) => ({ ...e, id: '' })
    expect(r.entries.map(strip)).toEqual(l.map(strip))
  })

  it('51b. an old "rest day" row is skipped with the reason', () => {
    const csv = [
      '"Show Time","Release Time","Crew Config","Route","Off Blocks","On Blocks","Part 135","24-hr Rest Day"',
      '"2026-01-05T00:00Z","2026-01-05T08:00Z","Single","KSJC-KSNA","100.0","102.0","True",""',
      '"2026-01-06T00:00Z","","Single","","","","","Yes"',
    ].join('\n')
    const r = importCSV(csv)
    if ('error' in r) throw new Error(r.error)
    expect(r.entries).toHaveLength(1)
    expect(r.skipped).toEqual([{ line: 3, reason: expect.stringContaining('rest-day row') }])
  })

  it('52. a row with a bad Hobbs reading is skipped with its line number; the rest import', () => {
    const csv = [
      '"Show Time","Release Time","Crew Config","Route","Off Blocks","On Blocks","Part 135"',
      '"2026-01-05T00:00Z","2026-01-05T08:00Z","Single","KSJC-KSNA","100.0","102.0","True"',
      '"2026-01-06T00:00Z","2026-01-06T08:00Z","Single","KSNA-KSJC","102.0","104.25","True"',
      '"2026-01-07T00:00Z","2026-01-07T08:00Z","Single","KSJC-KLAX","104.3","105.0","True"',
    ].join('\n')
    const r = importCSV(csv)
    if ('error' in r) throw new Error(r.error)
    expect(r.entries).toHaveLength(2)
    expect(r.skipped).toEqual([{ line: 3, reason: expect.stringContaining('tenths') }])
  })
})
