import { uid } from '@/lib/calculations'
import type { LegData } from '@/components/LegRow'

export function emptyLeg(): LegData {
  return { key: uid(), dep: '', arr: '', offHobbs: '', onHobbs: '', reason: '', part91: false }
}
