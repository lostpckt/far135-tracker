// Backup and restore (scenario 50, approved 2026-11-02).
import { describe, it, expect } from 'vitest'
import { buildBackup, parseBackup } from '@/lib/backup'
import { duty, log } from '@/lib/test-helpers'

describe('K. Backup and restore', () => {
  it('50. back up then restore gives back every entry exactly, old rest-day entries included', () => {
    const entries = log(
      duty(0, 12, [2.3, { flight: 1.0, part91: true }], { showTz: 'America/Denver', releaseTz: 'America/Chicago', entity: 'Acme Air' }),
      duty(30, 40, [8.6], { reason: 'Weather', crew: 'D' }),
      duty(50, 50, [0], { restDay: true, restStart: '2026-01-07T02:00Z', restEnd: '2026-01-08T02:00Z', validationVersion: 2 }),
    )
    const r = parseBackup(JSON.stringify(buildBackup(entries, 'America/Denver')))
    if ('error' in r) throw new Error(r.error)
    expect(r.entries).toEqual(entries)
    expect(r.tz).toBe('America/Denver')
  })

  it('a damaged entry rejects the whole file, so nothing is restored partly', () => {
    const entries = duty(0, 12, [2.0, 3.0])
    const file = buildBackup(entries, 'UTC') as unknown as { entries: Record<string, unknown>[] }
    delete file.entries[1].showTime
    const r = parseBackup(JSON.stringify(file))
    expect(r).toEqual({ error: expect.stringContaining('entry 2') })
  })
})
