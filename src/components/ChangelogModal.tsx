import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import changelogRaw from '../../CHANGELOG.md?raw'

function renderChangelog(raw: string) {
  return raw.split('\n').map((line, i) => {
    if (line.startsWith('# '))   return null
    if (line.startsWith('## '))  return <h2 key={i} className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-5 first:mt-0 pb-1 border-b border-slate-200 dark:border-slate-700">{line.slice(3)}</h2>
    if (line.startsWith('### ')) return <h3 key={i} className="text-[0.68rem] font-bold uppercase tracking-widest text-slate-400 mt-3 mb-1">{line.slice(4)}</h3>
    if (line.startsWith('- '))   return <li key={i} className="text-sm text-slate-600 dark:text-slate-300 ml-4 list-disc leading-snug">{line.slice(2)}</li>
    if (line.trim() === '')      return null
    return <p key={i} className="text-sm text-slate-600 dark:text-slate-300">{line}</p>
  })
}

// The bundled copy is from the build that's currently running. When an update is
// waiting, the deployed CHANGELOG.md is newer, so fetch it on open and fall back
// to the bundled copy when offline or in dev (where the file isn't served).
async function fetchDeployedChangelog(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}CHANGELOG.md`, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    // Guard against an HTML fallback page being served in place of a missing file.
    return text.startsWith('# Changelog') ? text : null
  } catch { return null }
}

export default function ChangelogModal({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState(changelogRaw)

  function handleOpenChange(open: boolean) {
    if (open) fetchDeployedChangelog().then(t => { if (t) setText(t) })
  }

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Changelog</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-1">
          {renderChangelog(text)}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
