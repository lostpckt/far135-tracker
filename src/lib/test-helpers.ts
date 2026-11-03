// Builders for the unit tests: describe a log in hours from a fixed start
// instead of writing out every ISO timestamp.
import type { Entry } from '@/types/entry'

export const BASE = Date.UTC(2026, 0, 5)          // 2026-01-05 00:00Z, a quiet week with no DST
export const HOUR = 3600000

/** A UTC ISO time `h` hours after BASE (fractions allowed: 23 + 59/60). */
export function at(h: number): string {
  return new Date(BASE + Math.round(h * 60) * 60000).toISOString().slice(0, 16) + 'Z'
}

let n = 0
let hobbs = 100000   // tenths; each new leg continues from the last so readings run forward

export interface LegSpec {
  flight: number        // hours, in tenths (2.3)
  part91?: boolean
  reason?: string
}

/**
 * One duty period from `show` to `release` (hours after BASE, or ISO strings),
 * with a leg per entry in `legs` (a bare number is a Part 135 leg of that many hours).
 */
export function duty(
  show: number | string,
  release: number | string,
  legs: (number | LegSpec)[],
  opts: Partial<Entry> = {},
): Entry[] {
  const showTime    = typeof show === 'number' ? at(show) : show
  const releaseTime = typeof release === 'number' ? at(release) : release
  return legs.map(l => {
    const spec = typeof l === 'number' ? { flight: l } : l
    const off = hobbs
    hobbs += Math.round(spec.flight * 10)
    return {
      id: `e${++n}`,
      pilot: '',
      crew: 'S',
      tailNumber: 'N135AB',
      showTime,
      releaseTime,
      dep: 'KSJC',
      arr: 'KSNA',
      offBlocks: `${Math.floor(off / 10)}.${off % 10}`,
      onBlocks: `${Math.floor(hobbs / 10)}.${hobbs % 10}`,
      reason: spec.reason ?? '',
      part91: spec.part91 ?? false,
      restStart: '',
      restEnd: '',
      restDay: false,
      ...opts,
    }
  })
}

/** Combine duties into the log the app keeps: sorted by show time. */
export function log(...duties: Entry[][]): Entry[] {
  return duties.flat().sort((a, b) => a.showTime.localeCompare(b.showTime))
}
