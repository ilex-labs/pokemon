import { useId } from 'react'
import type { IvPreset } from '../../data/schema'
import {
  defaultIvSpread,
  resolvePresetValues,
} from '../../data/loadGame'

export type IvPresetSelection = 'any' | 'custom' | string

type IvPresetRowProps = {
  presets: IvPreset[]
  maxIv: number
  generation: number
  selection: IvPresetSelection
  onSelect: (
    selection: IvPresetSelection,
    values?: Record<string, 'any' | number>,
  ) => void
}

/** Fixed slot so applying a preset never reflows the chip row. */
const RATIONALE_SLOT_CLASS = 'mt-2 min-h-[2.75rem] text-meta text-muted'

function presetRationale(preset: IvPreset, generation: number): string {
  return preset.rationaleByGeneration?.[generation] ?? preset.rationale
}

function Chip({
  selected,
  label,
  title,
  describedBy,
  onClick,
}: {
  selected: boolean
  label: string
  title?: string
  describedBy?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-describedby={describedBy}
      className={
        selected
          ? 'peer rounded border border-bright bg-raised px-3 py-1.5 text-sm text-bright'
          : 'peer rounded border border-edge bg-raised px-3 py-1.5 text-sm text-bright hover:border-bright'
      }
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default function IvPresetRow({
  presets,
  maxIv,
  generation,
  selection,
  onSelect,
}: IvPresetRowProps) {
  const tooltipIdPrefix = useId()

  const active =
    selection !== 'any' && selection !== 'custom'
      ? presets.find((preset) => preset.id === selection)
      : undefined
  const rationale = active
    ? presetRationale(active, generation)
    : selection === 'any'
      ? 'Every IV left unconstrained — no Destiny Knot or power-item pressure from the target.'
      : selection === 'custom'
        ? 'Edit each stat below. Exact values are available in this mode.'
        : null

  return (
    <div>
      <p className="label-caps mb-2">IV presets</p>
      <div className="flex flex-wrap gap-2">
        <span className="relative">
          <Chip
            selected={selection === 'any'}
            label="Any"
            title="Leave every IV unconstrained"
            onClick={() => onSelect('any', defaultIvSpread())}
          />
        </span>

        {presets.map((preset) => {
          const text = presetRationale(preset, generation)
          const tooltipId = `${tooltipIdPrefix}-${preset.id}`
          return (
            <span key={preset.id} className="relative">
              <Chip
                selected={selection === preset.id}
                label={preset.label}
                title={text}
                describedBy={tooltipId}
                onClick={() =>
                  onSelect(
                    preset.id,
                    resolvePresetValues(preset.values, maxIv),
                  )
                }
              />
              <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded border border-edge bg-raised px-2 py-1.5 text-left text-meta text-body opacity-0 transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
              >
                {text}
              </span>
            </span>
          )
        })}

        <span className="relative">
          <Chip
            selected={selection === 'custom'}
            label="Custom"
            title="Edit each IV stat individually"
            onClick={() => onSelect('custom')}
          />
        </span>
      </div>
      <div className={RATIONALE_SLOT_CLASS} aria-live="polite">
        {rationale ?? '\u00a0'}
      </div>
    </div>
  )
}
