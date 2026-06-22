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
}
