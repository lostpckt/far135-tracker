export default function RegNote() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
      <strong>Regulatory reference:</strong> 14 CFR §135.267 — Flight time limitations and rest
      requirements: Unscheduled one- and two-pilot crews.{' '}
      This tool is for <strong>reference and record-keeping only</strong>. Always verify compliance
      with your OpSpec, POI, and company manual. Show and Release times are entered in the
      timezone on the clock where you were, using the globe next to each time, and stored in Zulu.
    </div>
  )
}
