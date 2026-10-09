export interface Entry {
  id: string
  pilot: string
  crew: 'S' | 'D'
  tailNumber?: string   // Aircraft registration, e.g. "N123AB"
  entity?: string       // Operating certificate holder / air carrier name
  showTime: string      // UTC ISO, e.g. "2026-05-15T03:15Z"
  releaseTime: string
  dep: string
  arr: string
  offBlocks: string     // Hobbs reading in tenths, e.g. "12345.6" (older entries may lack the ".0")
  onBlocks: string      // Hobbs reading in tenths, e.g. "12345.6" (older entries may lack the ".0")
  reason: string
  part91: boolean
  // ── Legacy, no longer used ──────────────────────────────────────────────────
  // Rest is now derived: it runs from a duty period's release to the next duty
  // period's show. These are kept only so older stored data and backups still
  // load; new entries store '' / false, and calculations ignore them. Rest-day
  // entries (restDay: true) are kept in storage but hidden and ignored.
  restStart: string
  restEnd: string
  restDay: boolean
  restDayEnd?: string
  validationVersion?: number
}

export interface Computed {
  legFlight: number | null
  dutyPeriod: number | null
  consRest: number | null       // rest after this duty period: release → next show, h (null if none logged yet)
  maxFlight: number
  rolling24: number | null
  dutyFlight: number | null     // Part 135 flight time in this duty period, h
  cQualifies: boolean | null    // duty period meets §135.267(c), so its own flight time is what's limited
  excAmt: number
  reqRest: number | null
  lookbackOk: boolean | null
  flightOk: boolean | null
  dutyOk: boolean | null
  restOk: boolean | null
}
