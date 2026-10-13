import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HowToUse() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('far135_howto_collapsed') !== 'false'
  )

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('far135_howto_collapsed', String(next))
  }

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={toggle}>
        <CardTitle className="text-sm font-bold flex items-center justify-between">
          How to Use This Tool
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          />
        </CardTitle>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          <p className="text-[0.78rem] text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter one row per flight leg. Off Blocks and On Blocks are Hobbs meter readings in tenths of an hour (e.g. 12345.6). Flight time is calculated as On Hobbs − Off Hobbs. Enter Show Time and Release Time as the local clock read, and pick that zone with the globe next to each time. It starts on your device's timezone, so a duty that starts in PDT and ends in MDT can be entered without converting. For a multi-leg day, Show Time and Release Time are the same across legs; Hobbs readings change each leg. Rest is calculated for you: it runs from each Release Time to your next Show Time, so days off need no entry. Log every duty period, including Part 91, so rest is measured correctly.
          </p>
        </CardContent>
      )}
    </Card>
  )
}
