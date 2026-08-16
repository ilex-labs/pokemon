import { useEffect, useState } from 'react'
import type { NatureLock } from '../../data/schema'
import {
  isAllAnyIvs,
  natureDescription,
  resolvePresetValues,
  speciesAbilityGroups,
} from '../../data/loadGame'
import type { DaycareTarget, ShinyOddsTier } from '../../engine/daycareEngine'
import type { GameData, IvPreset, NaturesCatalog } from '../../data/schema'
import IvPresetRow, { type IvPresetSelection } from './IvPresetRow'
import IvTargetPicker from './IvTargetPicker'
import OptionDescription from './OptionDescription'
import SpeciesPicker from './SpeciesPicker'

type TargetSpreadFormProps = {
  value: DaycareTarget
  game: GameData
  speciesNames: string[]
  natures: NaturesCatalog
  abilityDescriptions: Record<string, string>
  moveDescriptions: Record<string, string>
  eggMoveOptions: string[]
  ivPresets: IvPreset[]
  maxIv: number
  generation: number
  naturesExist: boolean
  natureLock: NatureLock
  abilitiesExist: boolean
  abilityInheritanceExists: boolean
  hiddenAbilitiesExist: boolean
  /** True when this ruleset has Masuda (gen 4+). */
  masudaAvailable: boolean
  /** Base-tier shiny figure when the hatch-for-shiny toggle is on. */
  shinyHint?: ShinyOddsTier
  onChange: (next: DaycareTarget) => void
}

/** Constraint copy at the decision point — never a numbered plan step. */
function ConstraintNote({ text }: { text: string }) {
  return (
    <p className="mt-1 border-l-2 border-brass py-1 pl-3 text-sm text-body">
      {text}
    </p>
  )
}

function selectionFromIvs(
  ivs: Record<string, 'any' | number>,
  presets: IvPreset[],
  maxIv: number,
): IvPresetSelection {
  if (isAllAnyIvs(ivs)) return 'any'
  for (const preset of presets) {
    const resolved = resolvePresetValues(preset.values, maxIv)
    const match = Object.keys(resolved).every(
      (stat) => resolved[stat] === (ivs[stat] ?? 'any'),
    )
    if (match) return preset.id
  }
  return 'custom'
}

export default function TargetSpreadForm({
  value,
  game,
  speciesNames,
  natures,
  abilityDescriptions,
  moveDescriptions,
  eggMoveOptions,
  ivPresets,
  maxIv,
  generation,
  naturesExist,
  natureLock,
  abilitiesExist,
  abilityInheritanceExists,
  hiddenAbilitiesExist,
  masudaAvailable,
  shinyHint,
  onChange,
}: TargetSpreadFormProps) {
  const abilityGroups = speciesAbilityGroups(game, value.species, {
    hiddenAbilitiesExist,
  })
  const natureNames = Object.keys(natures).sort()
  const natureCannotLock = naturesExist && natureLock.method === 'none'
  const abilityCannotInherit = abilitiesExist && !abilityInheritanceExists

  const [ivSelection, setIvSelection] = useState<IvPresetSelection>(() =>
    selectionFromIvs(value.ivs, ivPresets, maxIv),
  )

  // Re-derive when IVs change from outside the chip row — but once the user
  // opens Custom, stay there even if every stat is still Any.
  useEffect(() => {
    setIvSelection((current) => {
      const matched = selectionFromIvs(value.ivs, ivPresets, maxIv)
      if (current === 'custom') {
        return matched !== 'any' && matched !== 'custom' ? matched : 'custom'
      }
      return matched
    })
  }, [value.ivs, ivPresets, maxIv])

  function patch(partial: Partial<DaycareTarget>) {
    onChange({ ...value, ...partial })
  }

  function toggleEggMove(move: string) {
    const selected = new Set(value.eggMoves)
    if (selected.has(move)) selected.delete(move)
    else selected.add(move)
    patch({ eggMoves: [...selected] })
  }

  function selectIvPreset(
    selection: IvPresetSelection,
    values?: Record<string, 'any' | number>,
  ) {
    setIvSelection(selection)
    if (values) patch({ ivs: values })
  }

  function changeIvs(ivs: Record<string, 'any' | number>) {
    // Manual edit while a named preset is active → Custom, reveal rows.
    if (ivSelection !== 'custom') setIvSelection('custom')
    patch({ ivs })
  }

  return (
    <div className="space-y-[var(--spacing-within)]">
      <SpeciesPicker
        speciesNames={speciesNames}
        value={value.species}
        onChange={(species) => {
          patch({
            species,
            ability: 'any',
            eggMoves: [],
          })
        }}
      />

      <label className="block">
        <span className="label-caps mb-1.5 block">Nature</span>
        <select
          className="w-full rounded border border-edge bg-raised px-3 py-2 text-sm text-bright"
          value={value.nature}
          onChange={(event) => patch({ nature: event.target.value })}
        >
          <option value="any">Any</option>
          {natureNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {natureCannotLock ? (
          <ConstraintNote text="This game cannot lock nature when pairing — pick a target to check hatches against, not to force one." />
        ) : null}
        {value.nature !== 'any' ? (
          <OptionDescription text={natureDescription(natures, value.nature)} />
        ) : null}
      </label>

      <label className="block">
        <span className="label-caps mb-1.5 block">Ability</span>
        <select
          className="w-full rounded border border-edge bg-raised px-3 py-2 text-sm text-bright"
          value={value.ability}
          onChange={(event) => patch({ ability: event.target.value })}
        >
          <option value="any">Any</option>
          {abilityGroups.standard.length > 0 ? (
            <optgroup label="Standard">
              {abilityGroups.standard.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {abilityGroups.hidden ? (
            <optgroup label="Hidden">
              <option value={abilityGroups.hidden}>
                {abilityGroups.hidden} (hidden)
              </option>
            </optgroup>
          ) : null}
        </select>
        {abilityCannotInherit ? (
          <ConstraintNote text="Ability is random on the hatch in this game — the egg rolls a standard ability, so parents cannot force one." />
        ) : null}
        {value.ability !== 'any' ? (
          <OptionDescription
            text={abilityDescriptions[value.ability] ?? ''}
          />
        ) : null}
      </label>

      <fieldset>
        <legend className="label-caps mb-2">Egg moves</legend>
        {eggMoveOptions.length === 0 ? (
          <p className="text-sm text-muted">No egg moves listed for this species.</p>
        ) : (
          <ul className="list-none space-y-3 p-0">
            {eggMoveOptions.map((move) => (
              <li key={move}>
                <label className="flex items-start gap-2 text-sm text-bright">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={value.eggMoves.includes(move)}
                    onChange={() => toggleEggMove(move)}
                  />
                  <span>
                    {move}
                    <OptionDescription text={moveDescriptions[move] ?? ''} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <IvPresetRow
        presets={ivPresets}
        maxIv={maxIv}
        generation={generation}
        selection={ivSelection}
        onSelect={selectIvPreset}
      />

      {ivSelection === 'custom' ? (
        <IvTargetPicker
          values={value.ivs}
          maxIv={maxIv}
          onChange={changeIvs}
        />
      ) : null}

      <div>
        <label className="flex items-center gap-2 text-sm text-bright">
          <input
            type="checkbox"
            checked={Boolean(value.wantsShiny)}
            onChange={(event) => patch({ wantsShiny: event.target.checked })}
          />
          Hatch for shiny
        </label>
        {value.wantsShiny && masudaAvailable ? (
          <ConstraintNote text="Requires a parent originating from a different-language game than its partner — not a specific foreign language. A pair you already have that differs already counts." />
        ) : null}
        {value.wantsShiny && !masudaAvailable ? (
          <ConstraintNote text="Nothing in this game improves egg shiny odds." />
        ) : null}
        {value.wantsShiny && shinyHint ? (
          <p className="mt-1.5 pl-6 text-meta text-muted">
            {shinyHint.label}{' '}
            <span className="num text-bright">{shinyHint.odds}</span>
            <span>
              {' '}
              · ~
              <span className="num">{shinyHint.approximateEggs.toLocaleString()}</span>{' '}
              eggs
            </span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
