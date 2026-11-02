import { useEffect, useState } from 'react'

// 3-character airport codes (US FAA identifiers, IATA codes) -> ICAO code(s),
// built by scripts/build-airports.py. Loaded on first use as its own chunk so
// it doesn't slow startup; the service worker precaches it for offline use.
type AirportMap = Map<string, string[]>
let map: AirportMap | null = null
let loading: Promise<AirportMap> | null = null

function loadAirports(): Promise<AirportMap> {
  loading ??= import('@/data/airports.txt?raw').then(m => {
    map = new Map()
    for (const line of m.default.split('\n')) {
      const [code, ...icao] = line.split(' ')
      if (code && icao.length) map.set(code, icao)
    }
    return map
  })
  return loading
}

/** ICAO codes a 3-character entry probably means (e.g. "SQL" -> ["KSQL"]); [] if none. */
export function icaoMatches(code: string): string[] {
  if (code.length !== 3 || !map) return []
  return map.get(code) ?? []
}

/** Re-renders once the airport list has loaded. */
export function useAirportsLoaded(): boolean {
  const [loaded, setLoaded] = useState(map !== null)
  useEffect(() => {
    if (!loaded) loadAirports().then(() => setLoaded(true), () => { /* offline before first cache: no suggestions */ })
  }, [loaded])
  return loaded
}
