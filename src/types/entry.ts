// Bump VALIDATION_RESET_EPOCH to force a full re-scan of all entries (e.g. after
// fixing a bug in an existing validation rule). Bump ENTRY_VALIDATION_VERSION to
// add a new incremental validation rule. Both are stored in localStorage as
// "epoch.version" so either change triggers the appropriate scan behaviour.
export const VALIDATION_RESET_EPOCH    = 2
export const ENTRY_VALIDATION_VERSION  = 1

export interface Entry {
  id: string
  pilot: string
  crew: 'S' | 'D'
  tailNumber?: string   // Aircraft registration, e.g. "N123AB"
  entity?: string       // Operating certificate holder / air carrier name
  showTime: string      // "YYYY-MM-DDTHH:MM"
  releaseTime: string
  dep: string
  arr: string
  offBlocks: string     // Hobbs meter reading stored as numeric string, e.g. "12345.6"
  onBlocks: string      // Hobbs meter reading stored as numeric string, e.g. "12345.6"
  restStart: string
  restEnd: string
  reason: string
  part91: boolean
  restDay: boolean
  restDayEnd?: string    // YYYY-MM-DD, set when a rest day entry spans multiple days
  validationVersion?: number
}

export interface Computed {
  legFlight: number | null
  dutyPeriod: number | null
  consRest: number | null
  maxFlight: number
  rolling24: number | null
  excAmt: number
  reqRest: number
  lookbackOk: boolean | null
  flightOk: boolean | null
  dutyOk: boolean | null
  restOk: boolean | null
  restOverlapOk: boolean | null
}
