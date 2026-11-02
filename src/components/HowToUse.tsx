import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

function HowToUseText() {
  return (
    <div className="text-[0.8rem] text-slate-600 dark:text-slate-400 leading-relaxed space-y-2.5">
      <p>
        Log each duty period as one <strong>duty entry</strong>, with one row per flight leg.
        For a multi-leg day, Show Time and Release Time are shared by every leg; the Hobbs readings change each leg.
      </p>
      <p>
        <strong>Off Blocks</strong> and <strong>On Blocks</strong> are Hobbs meter readings in tenths of an hour (e.g. 1234.5).
        Flight time for each leg is:
      </p>
      <p className="font-mono text-[0.8rem] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-md px-3 py-1.5 w-fit">
        Flight time = On Blocks <span className="font-bold">−</span> Off Blocks
      </p>
      <p>
        Enter <strong>Show Time</strong> and <strong>Release Time</strong> as the local clock read, in the timezone you
        were in at that moment, and pick that zone with the globe next to each time. Both start on your device's
        timezone, so a duty that starts in PDT and ends in MDT is entered without converting.
      </p>
      <p>
        <strong>Rest is calculated for you:</strong> it runs from each Release Time to your next Show Time, so days off
        need no entry. Log every duty period, including Part 91, so rest is measured correctly.
      </p>
    </div>
  )
}

// Always reachable from the header menu.
export function HowToUseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>How to Use This Tool</DialogTitle></DialogHeader>
        <HowToUseText />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}

// Shown on the main page, expanded, on first launch only.
export default function HowToUseCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="ring-blue-300 dark:ring-blue-800">
      <CardHeader>
        <CardTitle className="text-sm font-bold">How to Use This Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <HowToUseText />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.7rem] text-slate-400">You can find this again any time under the ☰ menu.</span>
          <button
            onClick={onDismiss}
            className="text-sm h-8 px-3 rounded-md bg-slate-900 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
