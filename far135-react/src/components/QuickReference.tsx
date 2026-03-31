import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const sections = [
  {
    title: 'Rolling 24-Hour Flight Time',
    body: 'Single pilot: max 8 hours in any consecutive 24-hour window. Dual pilot: max 10 hours. The window ends at the On Blocks time of the current leg and looks back 24 hours.',
  },
  {
    title: '10-Hour Look-Back Rest',
    body: 'Before any flight segment, the pilot must have received at least 10 consecutive hours of rest in the 24 hours preceding the completion of that segment. This tracker checks whether a qualifying rest period ended within the 24-hour lookback window.',
  },
  {
    title: '14-Hour Duty Day',
    body: 'Total duty period (Show Time to Release Time) must not exceed 14 hours. The tracker flags any duty period over 14 hours.',
  },
  {
    title: 'Quarterly Rest Requirement',
    body: 'Each pilot must receive at least 13 24-hour rest periods per calendar quarter. Check the "24-hour rest day" box on any day you had no duty. The dashboard shows your running count.',
  },
  {
    title: 'Exceedance Rest Multiplier',
    body: 'If flight time is exceeded (e.g., due to weather or an unforeseen delay): < 30 min over → 11 hrs rest required. 30–60 min over → 12 hrs required. > 60 min over → 16 hrs required.',
  },
  {
    title: 'How to Use This Tool',
    body: 'Enter one row per flight leg. For a multi-leg day, Show Time and Release Time will be the same across legs; Off/On Blocks change each leg. Rest fields only need to be filled on the last leg of the day. Mark 24-hr rest days with the checkbox (no flight fields needed).',
  },
]

export default function QuickReference() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">§135.267 Quick Reference</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
          {sections.map(s => (
            <div key={s.title} className="bg-slate-50 dark:bg-slate-800 rounded-lg px-3.5 py-3 border-l-[3px] border-blue-500">
              <h3 className="text-[0.8rem] font-bold text-slate-800 dark:text-slate-100 mb-1">{s.title}</h3>
              <p className="text-[0.78rem] text-slate-500 dark:text-slate-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
