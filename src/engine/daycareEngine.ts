import type {
  FeatureGate,
  GameData,
  PlanStep,
  RuleFlag,
  Ruleset,
  SpeciesEggData,
} from '../data/schema'

export type DaycareTarget = {
  species: string
  nature: string
  ability: string
  eggMoves: string[]
  ivs: Record<string, 'any' | number>
  wantsShiny?: boolean
}

export type DaycarePlan = {
  steps: PlanStep[]
  featureGates: FeatureGate[]
  /** True only when nothing is achievable (e.g. no valid parents at all). */
  blocked: boolean
}

type StepDraft = {
  id: string
  instruction: string
  ruleFlags?: RuleFlag[]
}

function needsDittoOnly(ratio: SpeciesEggData['genderRatio']): boolean {
  if (ratio === 'genderless' || ratio === 'male-only' || ratio === 'female-only') {
    return true
  }
  return ratio.malePercent === 0 || ratio.malePercent === 100
}

function eggGroupsForSpecies(game: GameData, species: string): string[] {
  return Object.entries(game.eggGroups)
    .filter(([, members]) => members.includes(species))
    .map(([group]) => group)
}

function sharesEggGroup(game: GameData, a: string, b: string): boolean {
  const groupsA = new Set(eggGroupsForSpecies(game, a))
  return eggGroupsForSpecies(game, b).some((group) => groupsA.has(group))
}

function isAbilityHidden(species: SpeciesEggData, ability: string): boolean {
  return species.abilities.hidden === ability
}

function isAllMaxIvs(
  ivs: Record<string, 'any' | number>,
  maxIv: number,
): boolean {
  const values = Object.values(ivs)
  if (values.length === 0) return false
  return values.every((value) => value === maxIv)
}

function hasZeroIv(ivs: Record<string, 'any' | number>): boolean {
  return Object.values(ivs).some((value) => value === 0)
}

function buildNatureStep(ruleset: Ruleset, nature: string): StepDraft {
  const lock = ruleset.natureLock

  if (lock.method === 'none') {
    return {
      id: 'nature',
      instruction: `Nature cannot be controlled when pairing in this game — ${nature} will be random on the hatch.`,
      ruleFlags: [
        {
          severity: 'warning',
          message: 'This era has no Everstone nature mechanic.',
        },
      ],
    }
  }

  if (lock.method === 'everstone-guaranteed') {
    const holder =
      lock.holder === 'either-parent'
        ? 'either parent'
        : 'the female parent or Ditto (on a Ditto pair, put the Everstone on the Ditto)'
    return {
      id: 'nature',
      instruction: `Hold an Everstone on ${holder} to guarantee the hatch inherits ${nature}.`,
    }
  }

  // everstone-chance
  const holder =
    lock.holder === 'either-parent'
      ? 'either parent'
      : 'the female parent or Ditto (on a Ditto pair, put the Everstone on the Ditto)'
  return {
    id: 'nature',
    instruction: `Hold an Everstone on ${holder} for a 50% chance the hatch inherits ${nature}.`,
    ruleFlags: [
      {
        severity: 'warning',
        message: 'Everstone only gives a 50% nature chance in this game.',
      },
    ],
  }
}

function buildParentStep(
  game: GameData,
  speciesName: string,
  species: SpeciesEggData,
): { step: StepDraft; blocked: boolean } {
  const dittoOnly = needsDittoOnly(species.genderRatio)

  if (dittoOnly && !game.ditto.available) {
    return {
      blocked: true,
      step: {
        id: 'parents',
        instruction: `${speciesName} can only pair with Ditto in this game, and Ditto is not obtainable here.`,
        ruleFlags: [
          {
            severity: 'blocking',
            message: `No valid pair exists for ${speciesName} — Ditto is unavailable in this game.`,
          },
        ],
      },
    }
  }

  const groups = eggGroupsForSpecies(game, speciesName)
  const groupList = groups.length > 0 ? groups.join(' / ') : 'unknown'
  const offspring = species.hatchesInto
  const parts: string[] = []

  if (dittoOnly) {
    // Only surface obtainedAt when Ditto is actually required for this pair.
    const where = game.ditto.obtainedAt
      ? ` (obtain Ditto: ${game.ditto.obtainedAt.replace(/\.+$/, '')})`
      : ''
    parts.push(
      `Pair ${speciesName} with Ditto${where}. Eggs from this line hatch as ${offspring}.`,
    )
  } else {
    parts.push(
      `Pair two compatible parents for ${speciesName} (egg groups: ${groupList}). Eggs hatch as ${offspring}.`,
    )
  }

  if (speciesName !== offspring) {
    parts.push(
      `If you need ${speciesName} specifically and eggs only produce ${offspring}, hatch ${offspring} and evolve it.`,
    )
  }

  return {
    blocked: false,
    step: {
      id: 'parents',
      instruction: parts.join(' '),
    },
  }
}

function buildIncenseStep(species: SpeciesEggData): StepDraft | null {
  if (!species.babyWithIncense || !species.incenseItem) return null
  return {
    id: 'incense',
    instruction: `Hold ${species.incenseItem} on a parent to hatch ${species.babyWithIncense} instead of ${species.hatchesInto}.`,
    ruleFlags: [
      {
        severity: 'warning',
        message: `Omitting the incense silently yields ${species.hatchesInto} instead of ${species.babyWithIncense}.`,
      },
    ],
  }
}

function buildAbilityStep(
  ruleset: Ruleset,
  speciesName: string,
  species: SpeciesEggData,
  ability: string,
): StepDraft {
  if (
    isAbilityHidden(species, ability) &&
    !ruleset.abilityInheritance.hiddenAbilityViaEggs
  ) {
    const alternatives: string[] = []
    if (ruleset.abilityInheritance.abilityPatchAvailable) {
      alternatives.push('Ability Patch')
    }
    if (ruleset.abilityInheritance.abilityCapsuleAvailable) {
      alternatives.push('Ability Capsule')
    }
    const altText =
      alternatives.length > 0
        ? ` Use ${alternatives.join(' / ')} or another acquisition method instead — hatch for the rest of the target, then apply the fix.`
        : ' Look for another acquisition method instead — hatch for the rest of the target first.'

    return {
      id: 'ability',
      instruction: `${ability} cannot be passed via eggs for ${speciesName} in this ruleset.${altText}`,
      ruleFlags: [
        {
          severity: 'blocking',
          message: `${ability} is a hidden ability and cannot be passed via eggs here.`,
        },
      ],
    }
  }

  const flags: RuleFlag[] = []
  if (ruleset.abilityInheritance.inheritanceOdds === 'TODO') {
    flags.push({
      severity: 'info',
      message:
        'Ability inheritance odds are not quoted here — the verified rate is still marked TODO in the ruleset.',
    })
  }

  return {
    id: 'ability',
    instruction: `Ensure a parent has ${ability} so the hatch can inherit that ability slot.`,
    ruleFlags: flags.length > 0 ? flags : undefined,
  }
}

function buildEggMoveSteps(
  game: GameData,
  ruleset: Ruleset,
  speciesName: string,
  eggMoves: string[],
): StepDraft[] {
  if (!ruleset.eggMovesExist || eggMoves.length === 0) return []

  const catalog = game.eggMoves[speciesName] ?? []
  const fatherOnly = ruleset.eggMoveEligibleParents === 'male-only'
  const parentRole = fatherOnly
    ? 'the father'
    : 'either parent'

  const steps: StepDraft[] = []

  for (const move of eggMoves) {
    const entry = catalog.find((item) => item.move === move)
    const sources = entry?.parentSpecies ?? []

    // Multi-gen chains only when a curated source is known to sit outside the
    // target's egg groups. Uncurated parentSpecies names are treated as direct
    // passers named by the egg-move data itself.
    const indirectSources = sources.filter((source) => {
      if (source === speciesName) return false
      const sourceGroups = eggGroupsForSpecies(game, source)
      if (sourceGroups.length === 0) return false
      return !sharesEggGroup(game, speciesName, source)
    })

    if (indirectSources.length > 0) {
      for (const source of indirectSources) {
        steps.push({
          id: `egg-move-${slug(move)}-via-${slug(source)}`,
          instruction: `First get ${move} onto an intermediate parent from ${source}, then have ${parentRole} pass ${move} into the ${speciesName} line.`,
        })
      }
    }

    let instruction = `Ensure ${parentRole} knows ${move}`
    if (sources.length > 0) {
      instruction += ` (passers include ${sources.join(', ')})`
    }
    instruction += '.'

    if (
      ruleset.eggMoveMethod === 'eggs-or-alternative' &&
      game.eggMoveAlternative
    ) {
      const alt = game.eggMoveAlternative
      instruction += ` Alternatively, use ${alt.name}: ${alt.howItWorks}`
    }

    steps.push({
      id: `egg-move-${slug(move)}`,
      instruction,
    })
  }

  return steps
}

function buildIvSteps(
  ruleset: Ruleset,
  ivs: Record<string, 'any' | number>,
): StepDraft[] {
  const { ivInheritance, hyperTraining } = ruleset
  const flags: RuleFlag[] = []

  if (hyperTraining.available && isAllMaxIvs(ivs, ivInheritance.maxIv)) {
    flags.push({
      severity: 'info',
      message: `A Gold Bottle Cap can max every IV at level ${hyperTraining.levelRequired} without the daycare — hatching is only worth it if the IVs need to be inheritable.`,
    })
  }

  if (hyperTraining.available && hasZeroIv(ivs)) {
    flags.push({
      severity: 'info',
      message:
        'Hyper Training only raises IVs and can never produce a 0. A 0 requires a parent that already has 0 in that stat. Hyper Trained parents pass their innate IVs, not the trained ones.',
    })
  }

  const steps: StepDraft[] = [
    {
      id: 'iv-base',
      instruction: `Plan IV inheritance around ${ivInheritance.baseCountInherited} IVs passed from the parents by default (max IV ${ivInheritance.maxIv}).`,
      ruleFlags: flags.length > 0 ? flags : undefined,
    },
  ]

  if (ivInheritance.destinyKnotAvailable) {
    steps.push({
      id: 'destiny-knot',
      instruction: `Hold a Destiny Knot to raise inherited IVs from ${ivInheritance.baseCountInherited} to ${ivInheritance.destinyKnotBoostedCount}.`,
    })
  }

  if (ivInheritance.powerItemsAvailable) {
    steps.push({
      id: 'power-items',
      instruction:
        'Use power items to lock specific parent IVs you care about into the hatch.',
    })
  }

  return steps
}

function buildShinySteps(game: GameData): StepDraft[] {
  const modifiers = game.shinyEggModifiers
  if (!modifiers) return []

  const steps: StepDraft[] = []

  if (modifiers.masudaMethodAvailable) {
    steps.push({
      id: 'masuda',
      instruction:
        'Masuda Method: pair parents from different-language games to raise shiny odds on eggs.',
    })
  }

  if (modifiers.shinyCharmAvailable) {
    const stackNote = modifiers.shinyCharmStacksWithMasuda
      ? ' It stacks with the Masuda Method.'
      : ''
    steps.push({
      id: 'shiny-charm',
      instruction: `Obtain the Shiny Charm to further raise egg shiny odds.${stackNote}`,
    })
  }

  steps.push({
    id: 'shiny-marks-pointer',
    instruction:
      'Encounter-based shiny or mark methods may be faster for this target — compare options in the Shiny & Marks tool rather than assuming eggs are best.',
  })

  return steps
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function finalizeSteps(drafts: StepDraft[]): PlanStep[] {
  return drafts.map((draft, index) => ({
    id: draft.id,
    order: index + 1,
    instruction: draft.instruction,
    ruleFlags: draft.ruleFlags,
  }))
}

/**
 * Build an ordered daycare plan from ruleset + game data + target spread.
 * Pure: no I/O, no framework imports, no per-game branching on game id.
 */
export function planDaycare(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
): DaycarePlan {
  const featureGates = game.featureGates ? [...game.featureGates] : []
  const drafts: StepDraft[] = []

  const species = game.species[target.species]
  if (!species) {
    return {
      featureGates,
      blocked: true,
      steps: finalizeSteps([
        {
          id: 'unknown-species',
          instruction: `${target.species} is not present in this game's species data.`,
          ruleFlags: [
            {
              severity: 'blocking',
              message: `No species entry for ${target.species}.`,
            },
          ],
        },
      ]),
    }
  }

  const parent = buildParentStep(game, target.species, species)
  drafts.push(parent.step)
  if (parent.blocked) {
    return { featureGates, blocked: true, steps: finalizeSteps(drafts) }
  }

  const incense = buildIncenseStep(species)
  if (incense) drafts.push(incense)

  if (ruleset.naturesExist) {
    drafts.push(buildNatureStep(ruleset, target.nature))
  }

  if (ruleset.abilitiesExist) {
    drafts.push(
      buildAbilityStep(ruleset, target.species, species, target.ability),
    )
  }

  drafts.push(
    ...buildEggMoveSteps(game, ruleset, target.species, target.eggMoves),
  )
  drafts.push(...buildIvSteps(ruleset, target.ivs))

  if (target.wantsShiny) {
    drafts.push(...buildShinySteps(game))
  }

  return {
    featureGates,
    blocked: false,
    steps: finalizeSteps(drafts),
  }
}
