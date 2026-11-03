// Timezone conversion and daylight saving (scenario section J, approved 2026-11-02).
import { describe, it, expect } from 'vitest'
import { localToUtcIso, nonexistentLocalTime, localTimeHint, fmtLocalDT, monthStartMs, utcToLocalParts } from '@/lib/timezone'

const NY = 'America/New_York'

describe('J. Timezones and daylight saving', () => {
  it('46. a time in the spring-forward gap is refused with an explanation', () => {
    // US clocks jumped 02:00 → 03:00 on Mar 8 2026.
    expect(localToUtcIso('2026-03-08', '02:30', NY)).toBe('')
    expect(nonexistentLocalTime('2026-03-08', '02:30', NY)).toBe(true)
    expect(localTimeHint('2026-03-08', '02:30', NY)).toContain('spring forward')
    expect(localToUtcIso('2026-03-08', '03:30', NY)).toBe('2026-03-08T07:30Z')
  })

  it('47. a time in the fall-back repeated hour uses the first (daylight-time) one', () => {
    // 01:30 happened twice on Nov 1 2026: EDT (05:30Z), then EST (06:30Z).
    expect(localToUtcIso('2026-11-01', '01:30', NY)).toBe('2026-11-01T05:30Z')
  })

  it('49. each time displays in its own zone; the stored moment is unchanged', () => {
    const t = '2026-07-01T15:00Z'
    expect(fmtLocalDT(t, 'America/Denver')).toBe('07/01 09:00 MDT')
    expect(fmtLocalDT(t, NY)).toBe('07/01 11:00 EDT')
    expect(fmtLocalDT(t, 'UTC')).toBe('07/01 15:00Z')
    expect(utcToLocalParts(localToUtcIso('2026-07-01', '09:00', 'America/Denver'), 'America/Denver'))
      .toEqual({ date: '2026-07-01', time: '09:00' })
  })

  it('month and quarter boundaries are local midnight in the home zone', () => {
    expect(new Date(monthStartMs(2026, 3, 'America/Denver')).toISOString()).toBe('2026-04-01T06:00:00.000Z')
    expect(new Date(monthStartMs(2026, 12, 'UTC')).toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})
