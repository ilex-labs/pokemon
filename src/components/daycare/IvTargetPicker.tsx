import { useState } from 'react'
import { IV_STAT_LABELS, type IvStat } from '../../data/loadGame'

type IvMode = 'any' | '0' | 'max' | 'exact'

type IvTargetPickerProps = {
  values: Record<string, 'any' | number>
  maxIv: number
  onChange: (values: Record<string, 'any' | number>) => void
}

function modeFor(value: 'any' | number, maxIv: number): IvMode {
  if (value === 'any') return 'any'
  if (value === 0) return '0'
  if (value === maxIv) return 'max'
  return 'exact'
}

function SegmentedButton({
  active,
  label,
  numeric = false,
  onClick,
}: {
  active: boolean
  label: string
  numeric?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? `${numeric ? 'num ' : ''}rounded border border-bright bg-raised px-2 py-1 text-caption font-medium text-bright`
          : `${numeric ? 'num ' : ''}rounded border border-transparent px-2 py-1 text-caption text-body hover:text-bright`
      }
    >
      {label}
    </button>
  )
}

export default function IvTargetPicker({
  values,
  maxIv,
  onChange,
}: IvTargetPickerProps) {
  const [showExact, setShowExact] = useState(() =>
    Object.values(values).some(
      (value) => typeof value === 'number' && value !== 0 && value !== maxIv,
    ),
  )

  function setStat(stat: IvStat, next: 'any' | number) {
    onChange({ ...values, [stat]: next })
  }

  const stats = Object.keys(IV_STAT_LABELS) as IvStat[]

  return (
    <fieldset>
      <legend className="mb-2 text-sm text-bright">IV targets</legend>

      <div className="divide-y divide-edge border-y border-edge">
        {stats.map((stat) => {
          const value = values[stat] ?? 'any'
          const mode = modeFor(value, maxIv)
          const exactValue = typeof value === 'number' ? value : maxIv

          return (
            <div key={stat} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-bright">
                  {IV_STAT_LABELS[stat]}
                </span>
                <div className="flex gap-0.5 rounded border border-edge p-0.5">
                  <SegmentedButton
                    active={mode === 'any'}
                    label="Any"
                    onClick={() => setStat(stat, 'any')}
                  />
                  <SegmentedButton
                    active={mode === '0'}
                    label="0"
                    numeric
                    onClick={() => setStat(stat, 0)}
                  />
                  <SegmentedButton
                    active={mode === 'max'}
                    label="Max"
                    numeric
                    onClick={() => setStat(stat, maxIv)}
                  />
                </div>
              </div>

              {showExact ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <span>Exact</span>
                  <input
                    type="number"
                    min={0}
                    max={maxIv}
                    value={mode === 'exact' ? exactValue : ''}
                    placeholder={`${0}–${maxIv}`}
                    className="num w-20 rounded border border-edge bg-raised px-2 py-1 text-bright"
                    onChange={(event) => {
                      const parsed = Number(event.target.value)
                      if (Number.isNaN(parsed)) return
                      const clamped = Math.min(
                        maxIv,
                        Math.max(0, Math.trunc(parsed)),
                      )
                      setStat(stat, clamped)
                    }}
                  />
                </label>
              ) : null}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className="mt-3 text-sm text-bright hover:text-body"
        onClick={() => setShowExact((current) => !current)}
      >
        {showExact ? 'Hide exact values' : 'Set exact values'}
      </button>
    </fieldset>
  )
}
