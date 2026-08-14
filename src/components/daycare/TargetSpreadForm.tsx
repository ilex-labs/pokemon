import type { NatureLock } from '../../data/schema'
import {
  natureDescription,
  speciesAbilityGroups,
} from '../../data/loadGame'
import type { DaycareTarget } from '../../engine/daycareEngine'
import type { GameData, IvPreset, NaturesCatalog } from '../../data/schema'
import IvPresetRow from './IvPresetRow'
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
  onChange,
}: TargetSpreadFormProps) {
  const abilityGroups = speciesAbilityGroups(game, value.species, {
    hiddenAbilitiesExist,
  })
  const natureNames = Object.keys(natures).sort()
  const natureCannotLock = naturesExist && natureLock.method === 'none'
  const abilityCannotInherit = abilitiesExist && !abilityInheritanceExists

  function patch(partial: Partial<DaycareTarget>) {
    onChange({ ...value, ...partial })
  }

  function toggleEggMove(move: string) {
    const selected = new Set(value.eggMoves)
    if (selected.has(move)) selected.delete(move)
    else selected.add(move)
    patch({ eggMoves: [...selected] })
  }

  return (
    <div className="space-y-6">
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
        <span className="mb-1 block text-sm text-bright">Nature</span>
        <select
          className="w-full rounded border border-edge bg-raised px-3 py-2 text-bright"
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
        <span className="mb-1 block text-sm text-bright">Ability</span>
        <select
          className="w-full rounded border border-edge bg-raised px-3 py-2 text-bright"
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
        <legend className="mb-2 text-sm text-bright">Egg moves</legend>
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
        onSelect={(ivs) => patch({ ivs })}
      />

      <IvTargetPicker
        values={value.ivs}
        maxIv={maxIv}
        onChange={(ivs) => patch({ ivs })}
      />

      <label className="flex items-center gap-2 text-sm text-bright">
        <input
          type="checkbox"
          checked={Boolean(value.wantsShiny)}
          onChange={(event) => patch({ wantsShiny: event.target.checked })}
        />
        Hatch for shiny (show Masuda / Shiny Charm odds)
      </label>
    </div>
  )
}
