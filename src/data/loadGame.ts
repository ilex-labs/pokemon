import type {
  GameData,
  IvPreset,
  NaturesCatalog,
  Ruleset,
} from './schema'
import naturesJson from './shared/natures.json'
import presetsJson from './shared/iv-presets.json'
import { unwrapSourced } from './unwrapSourced'

const gameModules = Object.fromEntries(
  Object.entries(
    import.meta.glob('./games/*.json', {
      eager: true,
      import: 'default',
    }) as Record<string, unknown>,
  ).map(([key, raw]) => [key, unwrapSourced(raw) as GameData]),
)

const rulesetModules = Object.fromEntries(
  Object.entries(
    import.meta.glob('./rulesets/*.json', {
      eager: true,
      import: 'default',
    }) as Record<string, unknown>,
  ).map(([key, raw]) => [key, unwrapSourced(raw) as Ruleset]),
)

export const natures = naturesJson as NaturesCatalog
export const sharedIvPresets = presetsJson as IvPreset[]

export const IV_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const
export type IvStat = (typeof IV_STATS)[number]

export const IV_STAT_LABELS: Record<IvStat, string> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
}

export type GameOption = {
  id: string
  displayName: string
  game: GameData
  ruleset: Ruleset
}

export function deepMergeRuleset(
  base: Ruleset,
  overrides?: Partial<Ruleset>,
): Ruleset {
  if (!overrides) return base
  return {
    ...base,
    ...overrides,
    abilityInheritance: {
      ...base.abilityInheritance,
      ...overrides.abilityInheritance,
    },
    ivInheritance: {
      ...base.ivInheritance,
      ...overrides.ivInheritance,
    },
    hyperTraining: {
      ...base.hyperTraining,
      ...overrides.hyperTraining,
    },
    natureLock: overrides.natureLock ?? base.natureLock,
  }
}

function loadRulesetForGeneration(generation: number): Ruleset | null {
  const match = Object.entries(rulesetModules).find(([, ruleset]) => {
    return ruleset.generation === generation
  })
  return match ? match[1] : null
}

function buildCatalog(): GameOption[] {
  const options: GameOption[] = []

  for (const game of Object.values(gameModules)) {
    const base = loadRulesetForGeneration(game.generation)
    if (!base) {
      console.warn(
        `No ruleset for generation ${game.generation} (game ${game.id})`,
      )
      continue
    }
    options.push({
      id: game.id,
      displayName: game.displayName,
      game,
      ruleset: deepMergeRuleset(base, game.rulesetOverrides),
    })
  }

  return options.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export const gamesCatalog: GameOption[] = buildCatalog()

export function getGameOption(gameId: string): GameOption | undefined {
  return gamesCatalog.find((option) => option.id === gameId)
}

export function filterIvPresets(
  presets: IvPreset[],
  generation: number,
): IvPreset[] {
  return presets.filter(
    (preset) =>
      preset.availableFrom === undefined || preset.availableFrom <= generation,
  )
}

/** Resolve symbolic `'max'` against the ruleset ceiling at selection time. */
export function resolvePresetValues(
  values: IvPreset['values'],
  maxIv: number,
): Record<string, 'any' | number> {
  const resolved: Record<string, 'any' | number> = {}
  for (const [stat, value] of Object.entries(values)) {
    if (value === 'max') resolved[stat] = maxIv
    else resolved[stat] = value
  }
  return resolved
}

export function natureDescription(
  naturesCatalog: NaturesCatalog,
  nature: string,
): string {
  const effect = naturesCatalog[nature]
  if (!effect) return ''
  if (effect.raises === null && effect.lowers === null) {
    return 'No raised or lowered stats.'
  }
  if (effect.raises && effect.lowers) {
    return `Raises ${effect.raises}, lowers ${effect.lowers}.`
  }
  if (effect.raises) return `Raises ${effect.raises}.`
  if (effect.lowers) return `Lowers ${effect.lowers}.`
  return ''
}

export function speciesAbilityOptions(
  gameData: GameData,
  speciesName: string,
): string[] {
  const groups = speciesAbilityGroups(gameData, speciesName)
  const options = [...groups.standard]
  if (groups.hidden) options.push(groups.hidden)
  return options
}

export function speciesAbilityGroups(
  gameData: GameData,
  speciesName: string,
  options?: { hiddenAbilitiesExist?: boolean },
): { standard: string[]; hidden?: string } {
  const species = gameData.species[speciesName]
  if (!species) return { standard: [] }
  const hiddenAllowed = options?.hiddenAbilitiesExist !== false
  return {
    standard: [...species.abilities.standard],
    hidden: hiddenAllowed ? species.abilities.hidden : undefined,
  }
}

export function defaultIvSpread(
  _maxIv?: number,
): Record<string, 'any' | number> {
  return Object.fromEntries(IV_STATS.map((stat) => [stat, 'any' as const]))
}

/** True when every tracked IV stat is unconstrained. */
export function isAllAnyIvs(
  ivs: Record<string, 'any' | number>,
): boolean {
  return IV_STATS.every((stat) => (ivs[stat] ?? 'any') === 'any')
}
