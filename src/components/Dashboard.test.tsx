// @vitest-environment jsdom
// Dashboard cards (screen-side checks, added 2026-11-02): the §135.267(a)
// period limits flag only when exceeded, and the quarter rest-period count.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import Dashboard from '@/components/Dashboard'
import { duty, log } from '@/lib/test-helpers'
import type { Entry } from '@/types/entry'

afterEach(() => { cleanup(); vi.useRealTimers() })

function show(entries: Entry[], now: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(now))
  render(<Dashboard entries={entries} tz="UTC" />)
}

const text = (re: RegExp) => screen.queryByText(re)

describe('§135.267(a) period limits on the dashboard: exactly at the limit is legal', () => {
  it('500 h in the quarter is OK; 500.1 h is EXCEEDED', () => {
    show(log(duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [500.0])), '2026-01-20T00:00Z')
    expect(text(/0h 00m remaining of 500h/)).not.toBeNull()
    expect(text(/500h quarterly limit EXCEEDED/)).toBeNull()
    cleanup()
    show(log(duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [500.1])), '2026-01-20T00:00Z')
    expect(text(/500h quarterly limit EXCEEDED/)).not.toBeNull()
  })

  it('800 h over this quarter and the last is OK; 800.1 h is EXCEEDED', () => {
    const q4 = duty('2025-12-01T00:00Z', '2025-12-01T12:00Z', [400.0])
    show(log(q4, duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [400.0])), '2026-01-20T00:00Z')
    expect(text(/0h 00m remaining of 800h/)).not.toBeNull()
    expect(text(/800h two-quarter limit EXCEEDED/)).toBeNull()
    cleanup()
    show(log(q4, duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [400.1])), '2026-01-20T00:00Z')
    expect(text(/800h two-quarter limit EXCEEDED/)).not.toBeNull()
    expect(text(/500h quarterly limit EXCEEDED/)).toBeNull()   // 400.1 in the quarter itself is fine
  })

  it('1,400 h in the calendar year is OK; 1,400.1 h is EXCEEDED', () => {
    show(log(duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [1400.0])), '2026-01-20T00:00Z')
    expect(text(/0h 00m remaining of 1,400h/)).not.toBeNull()
    expect(text(/1,400h annual limit EXCEEDED/)).toBeNull()
    cleanup()
    show(log(duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [1400.1])), '2026-01-20T00:00Z')
    expect(text(/1,400h annual limit EXCEEDED/)).not.toBeNull()
  })
})

describe('Quarter rest periods card', () => {
  // Duty on Jan 2, then the next duty N full days later: N rest periods.
  // "Now" is a few hours after the second duty, so the rest in progress adds none.
  const iso = (t: number) => new Date(t).toISOString().slice(0, 16) + 'Z'
  const released = Date.UTC(2026, 0, 2, 10)
  const restDays = (days: number, now: string) => show(log(
    duty('2026-01-02T00:00Z', iso(released), [2.0]),
    duty(iso(released + days * 864e5), iso(released + days * 864e5 + 10 * 3600e3), [2.0]),
  ), now)

  it('3 rest periods (one 72 h rest): "3 / 13", "Need 10 more"', () => {
    restDays(3, '2026-01-06T08:00Z')
    expect(text(/^3 \/ 13$/)).not.toBeNull()
    expect(text(/^Need 10 more$/)).not.toBeNull()
  })

  it('12 rest periods: "Need 1 more"', () => {
    restDays(12, '2026-01-15T00:00Z')
    expect(text(/^12 \/ 13$/)).not.toBeNull()
    expect(text(/^Need 1 more$/)).not.toBeNull()
  })

  it('13 rest periods: "Requirement met"', () => {
    restDays(13, '2026-01-16T00:00Z')
    expect(text(/^13 \/ 13$/)).not.toBeNull()
    expect(text(/^Requirement met$/)).not.toBeNull()
  })
})
