import type { Entry } from '@/types/entry'

const KEY = 'far135_v1'

export function loadEntries(): Entry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveEntries(entries: Entry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries))
}
