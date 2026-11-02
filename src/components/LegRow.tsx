import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import IcaoField from '@/components/IcaoField'
import { FieldError } from '@/components/FormHelpers'

export interface LegData {
  key?: string      // stable React key, so reordering keeps each leg's own field state
  id?: string       // the logged entry this leg edits (Edit Duty Entry only)
  dep: string
  arr: string
  offHobbs: string
  onHobbs: string
  reason: string
  part91: boolean
}

export type LegField = 'dep' | 'arr' | 'off' | 'on'

interface Props {
  index: number
  data: LegData
  onChange: (data: LegData) => void
  onRemove?: () => void      // no delete button when omitted (Leg 1)
  onMoveUp?: () => void
  onMoveDown?: () => void
  error?: { field?: LegField; msg: string }
  airportList?: string       // <datalist> id of airports used before
}

const iconBtn = 'rounded p-1 transition-colors'

export default function LegRow({ index, data, onChange, onRemove, onMoveUp, onMoveDown, error, airportList }: Props) {
  const set = (field: keyof LegData, value: string | boolean) =>
    onChange({ ...data, [field]: value })
  const bad = (f: LegField) => error?.field === f || undefined
  const n = index + 1

  return (
    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-2">
      <div className="flex gap-3 items-start">
        {/* Leg number stays on one line; reorder and delete sit under it (no delete on Leg 1). */}
        <div className="flex flex-col items-center gap-1 pt-5 shrink-0 w-11">
          <span className="text-xs font-bold text-blue-600 whitespace-nowrap">Leg {n}</span>
          {(onMoveUp || onMoveDown) && (
            <div className="flex">
              <button type="button" onClick={onMoveUp} disabled={!onMoveUp} aria-label={`Move leg ${n} up`} title="Move up"
                className={`${iconBtn} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:invisible`}>
                <ChevronUp size={16} />
              </button>
              <button type="button" onClick={onMoveDown} disabled={!onMoveDown} aria-label={`Move leg ${n} down`} title="Move down"
                className={`${iconBtn} text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:invisible`}>
                <ChevronDown size={16} />
              </button>
            </div>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} aria-label={`Delete leg ${n}`} title={`Delete leg ${n}`}
              className={`${iconBtn} p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950`}>
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 flex-1">
          <IcaoField
            label={<>Dep ICAO <span className="text-red-500">*</span></>}
            value={data.dep}
            onChange={v => set('dep', v)}
            placeholder="KSJC"
            labelClassName="text-[0.7rem]"
            inputClassName="w-[86px] px-2 uppercase text-sm h-8"
            invalid={bad('dep')}
            field={`leg${index}-dep`}
            list={airportList}
          />
          <IcaoField
            label={<>Arr ICAO <span className="text-red-500">*</span></>}
            value={data.arr}
            onChange={v => set('arr', v)}
            placeholder="KSNA"
            labelClassName="text-[0.7rem]"
            inputClassName="w-[86px] px-2 uppercase text-sm h-8"
            invalid={bad('arr')}
            field={`leg${index}-arr`}
            list={airportList}
          />

          <div className="flex flex-col gap-1" data-field={`leg${index}-off`}>
            <Label className="text-[0.7rem]">Off Blocks <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              value={data.offHobbs}
              onChange={e => set('offHobbs', e.target.value)}
              placeholder="1234.5"
              step="0.1"
              min="0"
              aria-invalid={bad('off')}
              className="text-sm h-8 w-[110px]"
            />
          </div>

          <div className="flex flex-col gap-1" data-field={`leg${index}-on`}>
            <Label className="text-[0.7rem]">On Blocks <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              value={data.onHobbs}
              onChange={e => set('onHobbs', e.target.value)}
              placeholder="1236.2"
              step="0.1"
              min="0"
              aria-invalid={bad('on')}
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

          <div className="flex flex-col gap-1 self-start">
            <Label className="text-[0.7rem]">&nbsp;</Label>
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
              <Checkbox
                id={`leg-${data.key ?? index}-p91`}
                checked={data.part91}
                onCheckedChange={v => set('part91', !!v)}
              />
              <label htmlFor={`leg-${data.key ?? index}-p91`} className="text-[0.75rem] font-semibold text-amber-800 dark:text-amber-400 cursor-pointer">
                Part 91
              </label>
            </div>
          </div>
        </div>
      </div>
      {error && <div className="mt-2 pl-14"><FieldError msg={error.msg} /></div>}
    </div>
  )
}
