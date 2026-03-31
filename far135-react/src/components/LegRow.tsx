import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { X } from 'lucide-react'

export interface LegData {
  dep: string
  arr: string
  offDate: string
  offTime: string
  onDate: string
  onTime: string
  reason: string
  part91: boolean
}

interface Props {
  index: number
  data: LegData
  onChange: (data: LegData) => void
  onRemove: () => void
  showRemove: boolean
}

export default function LegRow({ index, data, onChange, onRemove, showRemove }: Props) {
  const set = (field: keyof LegData, value: string | boolean) =>
    onChange({ ...data, [field]: value })

  return (
    <div className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-2">
      <div className="text-xs font-bold text-blue-600 min-w-[32px] text-center pt-5">
        Leg<br />{index + 1}
      </div>

      <div className="flex flex-wrap gap-2.5 flex-1">
        <div className="flex flex-col gap-1">
          <Label className="text-[0.7rem]">Dep ICAO</Label>
          <Input
            value={data.dep}
            onChange={e => set('dep', e.target.value.toUpperCase())}
            placeholder="KBOS"
            maxLength={4}
            className="w-[68px] uppercase text-sm h-8"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.7rem]">Arr ICAO</Label>
          <Input
            value={data.arr}
            onChange={e => set('arr', e.target.value.toUpperCase())}
            placeholder="KJFK"
            maxLength={4}
            className="w-[68px] uppercase text-sm h-8"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.7rem]">Off Blocks</Label>
          <div className="flex gap-1">
            <Input type="date" value={data.offDate} onChange={e => set('offDate', e.target.value)} className="text-sm h-8 w-[140px]" />
            <Input value={data.offTime} onChange={e => set('offTime', e.target.value)} placeholder="09:00" maxLength={5} className="text-sm h-8 w-[70px]" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.7rem]">On Blocks</Label>
          <div className="flex gap-1">
            <Input type="date" value={data.onDate} onChange={e => set('onDate', e.target.value)} className="text-sm h-8 w-[140px]" />
            <Input value={data.onTime} onChange={e => set('onTime', e.target.value)} placeholder="11:30" maxLength={5} className="text-sm h-8 w-[70px]" />
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <Label className="text-[0.7rem]">Exceedance Reason (optional)</Label>
          <Input
            value={data.reason}
            onChange={e => set('reason', e.target.value)}
            placeholder="e.g. Weather divert"
            className="text-sm h-8"
          />
        </div>

        <div className="flex flex-col gap-1 justify-end">
          <Label className="text-[0.7rem]">&nbsp;</Label>
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
            <Checkbox
              id={`leg-${index}-p91`}
              checked={data.part91}
              onCheckedChange={v => set('part91', !!v)}
            />
            <label htmlFor={`leg-${index}-p91`} className="text-[0.75rem] font-semibold text-amber-800 dark:text-amber-400 cursor-pointer">
              Part 91
            </label>
          </div>
        </div>
      </div>

      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:bg-red-50 rounded p-1 mt-4 self-center"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
