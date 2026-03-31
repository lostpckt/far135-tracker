export interface Entry {
  id: string
  pilot: string
  crew: 'S' | 'D'
  showTime: string      // "YYYY-MM-DDTHH:MM"
  releaseTime: string
  dep: string
  arr: string
  offBlocks: string
  onBlocks: string
  restStart: string
  restEnd: string
  reason: string
  part91: boolean
  restDay: boolean
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
