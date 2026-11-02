import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SECTION_CARD, SECTION_HEADER, SECTION_TITLE, ADD_FORM_ID } from '@/lib/section'
import DutyForm, { type DutyFormState } from '@/components/DutyForm'
import { emptyLeg } from '@/lib/legs'
import { utcToLocalParts, deviceTz } from '@/lib/timezone'
import type { Entry } from '@/types/entry'

const DRAFT_KEY = 'far135_v1_form_draft'

// Show and Release each have their own zone, defaulting to the device's, so
// a duty that starts in PDT and ends in MDT is entered as the clocks read.
function blankDuty(): DutyFormState {
  const tz = deviceTz()
  return {
    tailNumber: '', entity: '', crew: 'S',
    showDate: utcToLocalParts(new Date().toISOString(), tz)?.date ?? '', showTime: '',
    relDate: '', relTime: '', showTz: tz, relTz: tz,
    legs: [emptyLeg()],
  }
}

function readDraft(): DutyFormState {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
    // Older drafts may lack fields added since (e.g. the per-time zones).
    return d ? { ...blankDuty(), ...d } : blankDuty()
  } catch { return blankDuty() }
}

function saveDraft(s: DutyFormState) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(s)) } catch { /* localStorage unavailable */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* localStorage unavailable */ }
}

interface Props {
  entries: Entry[]
  tz: string
  onAdd: (updated: Entry[]) => void
}

export default function AddEntryForm({ entries, tz, onAdd }: Props) {
  // Bumping the key remounts the form empty (after adding, or "Clear form").
  const [formKey, setFormKey] = useState(0)
  function reset() { clearDraft(); setFormKey(k => k + 1) }

  return (
    <Card id={ADD_FORM_ID} className={`${SECTION_CARD} scroll-mt-4`}>
      <CardHeader className={SECTION_HEADER}>
        <CardTitle className={SECTION_TITLE}>Add Duty Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <DutyForm
          key={formKey}
          initial={formKey === 0 ? readDraft() : blankDuty()}
          entries={entries}
          tz={tz}
          onChange={saveDraft}
          onSubmit={legs => { onAdd([...entries, ...legs]); reset() }}
          onClear={reset}
        />
      </CardContent>
    </Card>
  )
}
