import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { X } from 'lucide-react'

export interface LegData {
  dep: string
  arr: string
  offHobbs: string
  onHobbs: string
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
          <Label className="text-[0.7rem]">Dep ICAO <span className="text-red-500">*</span></Label>
          <Input
            value={data.dep}
            onChange={e => set('dep', e.target.value.toUpperCase())}
            placeholder="KSJC"
            maxLength={4}
            className="w-[68px] uppercase text-sm h-8"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.7rem]">Arr ICAO <span className="text-red-500">*</span></Label>
          <Input
            value={data.arr}
            onChange={e => set('arr', e.target.value.toUpperCase())}
            placeholder="KSNA"
            maxLength={4}
            className="w-[68px] uppercase text-sm h-8"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.7rem]">Off Blocks (Hobbs) <span className="text-red-500">*</span></Label>
          <Input
            type="number"
            value={data.offHobbs}
            onChange={e => set('offHobbs', e.target.value)}
            placeholder="12345.6"
            step="0.1"
            min="0"
            className="text-sm h-8 w-[110px]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.7rem]">On Blocks (Hobbs) <span className="text-red-500">*</span></Label>
          <Input
            type="number"
            value={data.onHobbs}
            onChange={e => set('onHobbs', e.target.value)}
            placeholder="12347.3"
            step="0.1"
            min="0"
            className="text-sm h-8 w-[110px]"
          />
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
