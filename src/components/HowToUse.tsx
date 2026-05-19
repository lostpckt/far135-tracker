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
            Enter one row per flight leg. Off Blocks and On Blocks are Hobbs meter readings (5 digits + 1 decimal, e.g. 12345.6). Flight time is calculated as On Hobbs − Off Hobbs. For a multi-leg day, Show Time and Release Time are the same across legs; Hobbs readings change each leg. Rest fields only need to be filled on the last leg of the day. Mark 24-hr rest days with the checkbox (no flight fields needed).
          </p>
        </CardContent>
      )}
    </Card>
  )
}
