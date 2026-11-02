import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import DutyForm, { type DutyFormState } from '@/components/DutyForm'
import { splitForEdit } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

interface Props {
  legs: Entry[]          // the duty period's legs, in log order
  entries: Entry[]
  tz: string
  onSave: (legs: Entry[]) => void   // the duty's legs after editing (added, removed, reordered)
  onClose: () => void
}

// Edit a logged duty entry: everything the Add Duty Entry form has, plus
// adding, deleting and reordering its legs.
export default function EditDutyDialog({ legs, entries, tz, onSave, onClose }: Props) {
  const first = legs[0]
  // Each time edits in the zone it was entered in (home zone for older entries).
  const showTz = first.showTz ?? tz
  const relTz  = first.releaseTz ?? tz
  const s = splitForEdit(first.showTime, showTz)
  const r = splitForEdit(first.releaseTime, relTz)
  const mixedTail   = new Set(legs.map(l => l.tailNumber?.trim() ?? '')).size > 1
  const mixedEntity = new Set(legs.map(l => l.entity?.trim() ?? '')).size > 1

  const initial: DutyFormState = {
    tailNumber: mixedTail ? '' : first.tailNumber ?? '',
    entity:     mixedEntity ? '' : first.entity ?? '',
    crew: first.crew || 'S',
    showDate: s.d, showTime: s.t, relDate: r.d, relTime: r.t, showTz, relTz,
    // One reason per duty; older entries may have had a different one per leg.
    reason: [...new Set(legs.map(l => l.reason?.trim()).filter(Boolean))].join('; '),
    legs: legs.map(l => ({
      key: l.id, id: l.id, dep: l.dep, arr: l.arr,
      offHobbs: l.offBlocks, onHobbs: l.onBlocks, part91: !!l.part91,
    })),
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Edit Duty Entry</DialogTitle>
        </DialogHeader>
        <DutyForm
          initial={initial}
          entries={entries}
          tz={tz}
          editing={legs}
          mixed={{ tail: mixedTail, entity: mixedEntity }}
          onSubmit={onSave}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
