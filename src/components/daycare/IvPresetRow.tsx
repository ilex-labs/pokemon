import { useId, useState } from 'react'
import type { IvPreset } from '../../data/schema'
import { resolvePresetValues } from '../../data/loadGame'

type IvPresetRowProps = {
  presets: IvPreset[]
  maxIv: number
  generation: number
  onSelect: (values: Record<string, 'any' | number>) => void
}

/** Fixed slot so applying a preset never reflows the chip row. */
const RATIONALE_SLOT_CLASS =
  'mt-2 min-h-[2.75rem] text-sm text-muted'

function presetRationale(preset: IvPreset, generation: number): string {
  return preset.rationaleByGeneration?.[generation] ?? preset.rationale
}

export default function IvPresetRow({
  presets,
  maxIv,
  generation,
  onSelect,
}: IvPresetRowProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const tooltipIdPrefix = useId()

  const active = presets.find((preset) => preset.id === activeId)
  const rationale = active ? presetRationale(active, generation) : null

  return (
    <div>
      <p className="mb-2 text-sm text-bright">IV presets</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const selected = activeId === preset.id
          const text = presetRationale(preset, generation)
          const tooltipId = `${tooltipIdPrefix}-${preset.id}`

          return (
            <span key={preset.id} className="relative">
              <button
                type="button"
                title={text}
                aria-describedby={tooltipId}
                className={
                  selected
                    ? 'peer rounded border border-bright bg-raised px-3 py-1.5 text-sm text-bright'
                    : 'peer rounded border border-edge bg-raised px-3 py-1.5 text-sm text-bright hover:border-bright'
                }
                onClick={() => {
                  setActiveId(preset.id)
                  onSelect(resolvePresetValues(preset.values, maxIv))
                }}
              >
                {preset.label}
              </button>
              <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded border border-edge bg-raised px-2 py-1.5 text-left text-caption text-body opacity-0 shadow-sm transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
              >
                {text}
              </span>
            </span>
          )
        })}
      </div>
      <div className={RATIONALE_SLOT_CLASS} aria-live="polite">
        {rationale ?? '\u00a0'}
      </div>
    </div>
  )
}
