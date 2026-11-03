// PDF reports (screen-side check, added 2026-11-02): the Part 91 flight-hours
// line in the monthly and quarterly scorecards, and the §135.267(a) limit rows.
// The table library is replaced by a recorder, so the test reads each table's
// rows instead of the drawn PDF.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateMonthlyReportPDF, generateQuarterlyReportPDF } from '@/lib/pdf-report'
import { duty, log } from '@/lib/test-helpers'

const { tables } = vi.hoisted(() => ({ tables: [] as unknown[][][] }))

vi.mock('jspdf-autotable', () => ({
  default: (doc: { lastAutoTable?: { finalY: number } }, opts: { body: unknown[][] }) => {
    tables.push(opts.body)
    doc.lastAutoTable = { finalY: 100 }
  },
}))

// No file download in tests.
vi.mock('jspdf', async orig => {
  const m = await orig<typeof import('jspdf')>()
  class NoSave extends m.jsPDF {
    constructor(...a: ConstructorParameters<typeof m.jsPDF>) { super(...a); this.save = (() => this) as never }
  }
  return { ...m, jsPDF: NoSave }
})

beforeEach(() => { tables.length = 0 })

/** The scorecard row whose first cell is `label`, as [label, value]. */
const row = (label: string) => tables.flat().find(r => Array.isArray(r) && r[0] === label)

// January 2026: 3.0 h Part 135, plus 1.5 h and 0.7 h Part 91.
const jan = () => log(
  duty('2026-01-05T14:00Z', '2026-01-05T22:00Z', [3.0, { flight: 1.5, part91: true }]),
  duty('2026-01-08T14:00Z', '2026-01-08T18:00Z', [{ flight: 0.7, part91: true }], { entity: 'Lawton' }),
)

describe('PDF Part 91 flight hours line', () => {
  it('monthly report: Part 91 hours shown separately from Part 135', () => {
    expect(generateMonthlyReportPDF(jan(), 0, 2026, 'UTC')).toBe(true)
    expect(row('Part 91 Flight Hours (Month)')).toEqual(['Part 91 Flight Hours (Month)', '2.2h'])
    expect(row('Part 135 Flight Hours (Month)')).toEqual(['Part 135 Flight Hours (Month)', '3.0h'])
  })

  it('quarterly report: Part 91 hours line, and Part 91 left out of the 500 h figure', () => {
    expect(generateQuarterlyReportPDF(jan(), 0, 2026, 'UTC')).toBe(true)
    expect(row('Part 91 Flight Hours (Quarter)')).toEqual(['Part 91 Flight Hours (Quarter)', '2.2h'])
    expect(row('Quarterly Flight Hours Sec. 135.267(a)')).toEqual(['Quarterly Flight Hours Sec. 135.267(a)', '3.0h of 500h quarterly — OK'])
  })

  it('no Part 91 flying: the line reads 0.0h', () => {
    generateMonthlyReportPDF(log(duty('2026-01-05T14:00Z', '2026-01-05T22:00Z', [3.0])), 0, 2026, 'UTC')
    expect(row('Part 91 Flight Hours (Month)')).toEqual(['Part 91 Flight Hours (Month)', '0.0h'])
  })
})

describe('PDF §135.267(a) limit rows: exactly at the limit is legal', () => {
  it('500.0 h is OK; 500.1 h EXCEEDS', () => {
    generateQuarterlyReportPDF(log(duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [500.0])), 0, 2026, 'UTC')
    expect(row('Quarterly Flight Hours Sec. 135.267(a)')?.[1]).toBe('500.0h of 500h quarterly — OK')
    tables.length = 0
    generateQuarterlyReportPDF(log(duty('2026-01-10T00:00Z', '2026-01-10T12:00Z', [500.1])), 0, 2026, 'UTC')
    expect(row('Quarterly Flight Hours Sec. 135.267(a)')?.[1]).toBe('500.1h — EXCEEDS 500h quarterly')
  })
})
