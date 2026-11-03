// @vitest-environment jsdom
// Duty form, Exceedance Reason (screen-side check, added 2026-11-02): an
// exceedance can't be saved without a reason, and the one reason is saved on
// every leg of the duty.
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import DutyForm, { type DutyFormState } from '@/components/DutyForm'
import { duty } from '@/lib/test-helpers'
import type { Entry } from '@/types/entry'

beforeAll(() => { Element.prototype.scrollIntoView = () => {} })   // jsdom has no layout
afterEach(cleanup)

// Single pilot, 07:00–19:00 UTC, two Part 135 legs totalling `flights` hours.
function form(flights: [number, number], extra: Partial<DutyFormState> = {}): DutyFormState {
  return {
    tailNumber: 'N135AB', entity: 'WCPA', crew: 'S',
    showDate: '2026-01-05', showTime: '07:00', relDate: '2026-01-05', relTime: '19:00',
    showTz: 'UTC', relTz: 'UTC', reason: '',
    legs: [
      { key: 'a', dep: 'KAPA', arr: 'KCOS', offHobbs: '1000.0', onHobbs: (1000 + flights[0]).toFixed(1), part91: false },
      { key: 'b', dep: 'KCOS', arr: 'KAPA', offHobbs: (1000 + flights[0]).toFixed(1), onHobbs: (1000 + flights[0] + flights[1]).toFixed(1), part91: false },
    ],
    ...extra,
  }
}

function add(state: DutyFormState, entries: Entry[] = []) {
  const onSubmit = vi.fn()
  render(<DutyForm initial={state} entries={entries} tz="UTC" onSubmit={onSubmit} />)
  return { onSubmit, save: () => fireEvent.click(screen.getByRole('button', { name: 'Add to Flight Log' })) }
}

describe('Exceedance Reason on the duty form', () => {
  it('8.9 h single pilot: the reason is required, then saved on every leg', () => {
    const { onSubmit, save } = add(form([4.5, 4.4]))
    expect(screen.getByText('Over the flight time limit by 0h 54m. Required to save.')).toBeTruthy()

    save()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter the reason for the exceedance.')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('e.g. Weather divert'), { target: { value: '  Weather divert ' } })
    save()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const legs: Entry[] = onSubmit.mock.calls[0][0]
    expect(legs).toHaveLength(2)
    expect(legs.map(l => l.reason)).toEqual(['Weather divert', 'Weather divert'])
  })

  it('8.0 h single pilot is at the limit, not over: no reason box, saves with no reason', () => {
    const { onSubmit, save } = add(form([4.0, 4.0]))
    expect(screen.queryByPlaceholderText('e.g. Weather divert')).toBeNull()
    save()
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0].map((l: Entry) => l.reason)).toEqual(['', ''])
  })

  it('the exceedance counts earlier flying in the 24-hour window, too', () => {
    // 3.0 h flown earlier the same day plus 5.5 h on this duty = 8.5 h in the window.
    // (Another aircraft, so its Hobbs readings aren't compared with this one's.)
    const earlier = duty('2026-01-04T22:00Z', '2026-01-05T02:00Z', [3.0], { tailNumber: 'N999ZZ' })
    const { onSubmit, save } = add(form([3.0, 2.5]), earlier)
    expect(screen.getByText('Over the flight time limit by 0h 30m. Required to save.')).toBeTruthy()
    save()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Enter the reason for the exceedance.')).toBeTruthy()
  })
})
