/**
 * Build a daycare plan from ruleset + game data + target spread.
 * Pure: no I/O, no framework imports, no per-game branching on game id.
 *
 * Primary output is pairing strategies (viable routes), not a single pair.
 * Steps describe what to do for the recommended strategy.
 */

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
  /** Opt-in — power items are never assumed from IV targets alone. */
  wantsPowerItem?: boolean
}

export type ParentRequirement = {
  role: 'A' | 'B'
  species: string[]
  gender?: 'male' | 'female'
  /** Why this gender is forced — required whenever gender is set. */
  genderReason?: string
  mustKnow?: string[]
  mustHaveAbility?: string
  mustHaveNature?: string
  heldItem?: string
  /** Why this held item is assigned — required whenever heldItem is set. */
  heldItemReason?: string
  acquisition?: RuleFlag[]
}

export type PairingStrategy = {
  id: string
  label: string
  parents: ParentRequirement[]
  /** Chooser line — what you have to go acquire for this route. */
  acquisitionCost: string
  /** Longer trade-off note for detail / dumps; not the chooser. */
  tradeoff: string
  recommended?: boolean
  /** Required whenever recommended — e.g. "Fewer parents to obtain". */
  recommendReason?: string
}

export type ShinyOddsTier = {
  id: 'base' | 'masuda' | 'masudaPlusCharm'
  label: string
  odds: string
  approximateEggs: number
}

export type ShinyOdds = {
  tiers: ShinyOddsTier[]
}

export type DaycarePlan = {
  strategies: PairingStrategy[]
  /**
   * When multiple routes exist and none is recommended — they cost the same
   * number of parents to acquire.
   */
  routesEquivalent?: boolean
  /**
   * Routes that would otherwise appear but cannot produce this target —
   * always explained, never silently dropped.
   */
  excludedStrategies?: Array<{
    id: string
    label: string
    reason: string
  }>
  /** Steps for the recommended strategy (or the first / selected default). */
  steps: PlanStep[]
  featureGates: FeatureGate[]
  shiny?: ShinyOdds
  blocked: boolean
}

type StepDraft = {
  id: string
  instruction: string
  ruleFlags?: RuleFlag[]
}

type HeldItemId = 'everstone' | 'destiny-knot' | 'power-item'

type HeldItemDemand = {
  id: HeldItemId
  label: string
  placement: 'either' | 'female-or-ditto'
  /** One line naming the target attribute this item serves. */
  reason: string
}

/** True when this ruleset has any held item that can change egg outcomes. */
export function eggAffectingHeldItemsExist(ruleset: Ruleset): boolean {
  const natureLock =
    ruleset.natureLock.method === 'everstone-guaranteed' ||
    ruleset.natureLock.method === 'everstone-chance'
  return (
    natureLock ||
    ruleset.ivInheritance.destinyKnotAvailable ||
    ruleset.ivInheritance.powerItemsAvailable
  )
}

function needsDittoOnly(ratio: SpeciesEggData['genderRatio']): boolean {
  if (ratio === 'genderless' || ratio === 'male-only' || ratio === 'female-only') {
    return true
  }
  return ratio.malePercent === 0 || ratio.malePercent === 100
}

/** Male-only or genderless — no female of the line to pass an ability without Ditto. */
function isMaleOrGenderlessRatio(ratio: SpeciesEggData['genderRatio']): boolean {
  if (ratio === 'genderless' || ratio === 'male-only') return true
  if (typeof ratio === 'object' && ratio.malePercent === 100) return true
  return false
}

function formatOddsPercent(odds: number): string {
  return `${Math.round(odds * 100)}%`
}

/**
 * When maleOrGenderlessNeedsDitto, species-pair needs a female ability carrier.
 * Male-only / genderless lines cannot provide one — Ditto is the only route.
 */
function speciesPairAbilityExclusion(
  ruleset: Ruleset,
  species: SpeciesEggData,
  target: DaycareTarget,
): string | null {
  if (!wantsAbility(target, ruleset, species)) return null
  if (!ruleset.abilityInheritance.inheritanceExists) return null
  if (!ruleset.abilityInheritance.maleOrGenderlessNeedsDitto) return null
  if (!isMaleOrGenderlessRatio(species.genderRatio)) return null

  const ability = target.ability
  const hidden = isAbilityHidden(species, ability)
  if (hidden) {
    return `${ability} can't be passed on a species pair — a male or genderless parent only passes its hidden ability when paired with Ditto.`
  }
  return `${ability} can't be passed on a species pair — a male or genderless parent only passes its ability when paired with Ditto.`
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

/**
 * True when the hatch can only get this ability by inheriting a parent's slot.
 * A species' sole standard ability is automatic — every non-hidden hatch gets it,
 * so targeting it must not manufacture acquisition, gender, or odds work.
 */
function abilityRequiresInheritance(
  species: SpeciesEggData,
  ability: string,
): boolean {
  if (isAbilityHidden(species, ability)) return true
  return species.abilities.standard.length > 1
}

/** Sentinel for optional nature / ability — matches the form "Any" option. */
export const ANY_CHOICE = 'any'

function isAnyChoice(value: string): boolean {
  return value === ANY_CHOICE || value === ''
}

function wantsNature(target: DaycareTarget, ruleset: Ruleset): boolean {
  // method "none" means nature cannot be locked — selecting one must not
  // invent Everstone work, acquisition, or gender constraints.
  return (
    ruleset.naturesExist &&
    ruleset.natureLock.method !== 'none' &&
    !isAnyChoice(target.nature)
  )
}

function wantsAbility(
  target: DaycareTarget,
  ruleset: Ruleset,
  species: SpeciesEggData,
): boolean {
  return (
    ruleset.abilitiesExist &&
    ruleset.abilityInheritance.inheritanceExists &&
    !isAnyChoice(target.ability) &&
    abilityRequiresInheritance(species, target.ability)
  )
}

/**
 * No nature lock, ability inheritance, egg moves, or specific IVs — the
 * Masuda-style hatch where the only job is pairing and hatching.
 */
function isUnconstrainedTarget(
  target: DaycareTarget,
  ruleset: Ruleset,
  species: SpeciesEggData,
): boolean {
  return (
    !wantsNature(target, ruleset) &&
    !wantsAbility(target, ruleset, species) &&
    target.eggMoves.length === 0 &&
    !hasSpecificIvTargets(target.ivs) &&
    !Boolean(target.wantsPowerItem)
  )
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

function hasSpecificIvTargets(ivs: Record<string, 'any' | number>): boolean {
  return Object.values(ivs).some((value) => typeof value === 'number')
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

function pushAcquisition(parent: ParentRequirement, flag: RuleFlag) {
  parent.acquisition = [...(parent.acquisition ?? []), flag]
}

function eggMovePasserSpecies(
  game: GameData,
  speciesName: string,
  eggMoves: string[],
): string[] {
  const catalog = game.eggMoves[speciesName] ?? []
  const passers = new Set<string>()
  for (const move of eggMoves) {
    const entry = catalog.find((item) => item.move === move)
    for (const source of entry?.parentSpecies ?? []) {
      passers.add(source)
    }
  }
  return [...passers]
}

function natureAcquisitionFlags(game: GameData, nature: string): RuleFlag[] {
  const flags: RuleFlag[] = []
  if (game.natureAcquisition?.how) {
    flags.push({
      severity: 'info',
      message: `Acquire a ${nature} parent first: ${game.natureAcquisition.how}`,
    })
  }
  if (game.mintsAvailable) {
    flags.push({
      severity: 'warning',
      message:
        "Nature Mints only change battle stats — a minted Pokémon still passes its original nature. An item that fixes a Pokémon for battle does not fix it for the daycare.",
    })
  }
  return flags
}

function abilityAcquisitionFlag(
  game: GameData,
  ruleset: Ruleset,
  species: SpeciesEggData,
  ability: string,
): RuleFlag | undefined {
  if (!ruleset.abilitiesExist) return undefined

  if (isAbilityHidden(species, ability)) {
    const how =
      game.abilityAcquisition?.hidden ??
      'Obtain a parent that already has this hidden ability, or use an Ability Patch where available.'
    const canPass = ruleset.abilityInheritance.hiddenAbilityViaEggs
    return {
      severity: canPass ? 'info' : 'blocking',
      message: canPass
        ? `${ability} is a hidden ability — ${how}`
        : `${ability} cannot be passed via eggs here. ${how}`,
    }
  }

  if (game.abilityAcquisition?.standard) {
    return {
      severity: 'info',
      message: `Acquire ${ability}: ${game.abilityAcquisition.standard}`,
    }
  }
  return undefined
}

function formatSpeciesList(names: string[]): string {
  if (names.length === 0) return 'that species'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} or ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`
}

/** Female nature/ability holder — female determines offspring species. */
function genderReasonFemaleSpeciesHolder(offspringSpecies: string): string {
  return `Female because the female parent determines the offspring's species — eggs hatch as ${offspringSpecies}.`
}

/** Same-species partner opposite the female holder. */
function genderReasonMaleSameSpeciesPartner(): string {
  return "Male because the pair can't both be female."
}

/** Different-species egg-move carrier — a female would hatch as that species. */
function genderReasonMaleExternalCarrier(carrierSpecies: string[]): string {
  if (carrierSpecies.length === 1) {
    const name = carrierSpecies[0]!
    return `Male because a female ${name} would produce ${name} eggs instead.`
  }
  return `Male because a female of that species (${formatSpeciesList(carrierSpecies)}) would produce its own eggs instead.`
}

/**
 * Power items only when opted in — never inferred from having numeric IV
 * targets. Destiny Knot still applies when specific IVs are set.
 * Everstone only when the target asks for a nature.
 */
function collectHeldItemDemands(
  ruleset: Ruleset,
  target: DaycareTarget,
): HeldItemDemand[] {
  const demands: HeldItemDemand[] = []
  const lock = ruleset.natureLock
  const ivs = target.ivs
  const wantsPowerItem = Boolean(target.wantsPowerItem)

  if (
    wantsNature(target, ruleset) &&
    (lock.method === 'everstone-guaranteed' ||
      lock.method === 'everstone-chance')
  ) {
    demands.push({
      id: 'everstone',
      label: 'Everstone',
      placement:
        lock.holder === 'female-or-ditto' ? 'female-or-ditto' : 'either',
      reason:
        lock.method === 'everstone-guaranteed'
          ? `Guarantees the hatch inherits ${target.nature}.`
          : `Gives a 50% chance the hatch inherits ${target.nature}.`,
    })
  }

  if (hasSpecificIvTargets(ivs) && ruleset.ivInheritance.destinyKnotAvailable) {
    const { baseCountInherited, destinyKnotBoostedCount } = ruleset.ivInheritance
    demands.push({
      id: 'destiny-knot',
      label: 'Destiny Knot',
      placement: 'either',
      reason: `Serves the IV target — raises inherited IVs from ${baseCountInherited} to ${destinyKnotBoostedCount}.`,
    })
  }

  if (
    wantsPowerItem &&
    ruleset.ivInheritance.powerItemsAvailable &&
    hasSpecificIvTargets(ivs)
  ) {
    demands.push({
      id: 'power-item',
      label: 'a power item',
      placement: 'either',
      reason: 'Serves the IV target — locks one specific parent IV into the hatch.',
    })
  }

  return demands
}

function allocateHeldItems(
  parents: ParentRequirement[],
  demands: HeldItemDemand[],
  dittoPair: boolean,
): RuleFlag | undefined {
  if (demands.length === 0 || parents.length === 0) return undefined

  const byId = new Map(demands.map((demand) => [demand.id, demand]))
  const remaining = new Set<HeldItemId>(demands.map((demand) => demand.id))

  function parentByRole(role: 'A' | 'B') {
    return parents.find((entry) => entry.role === role)
  }

  function assignTo(
    parent: ParentRequirement | undefined,
    demand: HeldItemDemand,
  ) {
    if (!parent || parent.heldItem) return false
    parent.heldItem = demand.label
    parent.heldItemReason = demand.reason
    return true
  }

  function freeParents(): ParentRequirement[] {
    return parents.filter((parent) => !parent.heldItem)
  }

  const everstone = byId.get('everstone')
  if (everstone) {
    if (everstone.placement === 'female-or-ditto') {
      if (dittoPair) {
        assignTo(parentByRole('B'), everstone)
      } else {
        const natureParent =
          parents.find((parent) => parent.mustHaveNature) ?? parents[0]
        if (natureParent) {
          if (!natureParent.gender) {
            natureParent.gender = 'female'
            if (!natureParent.genderReason) {
              natureParent.genderReason = genderReasonFemaleSpeciesHolder(
                natureParent.species[0] ?? 'the target',
              )
            }
          }
          assignTo(natureParent, everstone)
        }
      }
    } else {
      const natureParent =
        parents.find((parent) => parent.mustHaveNature) ?? parents[0]
      if (natureParent) {
        assignTo(natureParent, everstone)
      }
    }
    remaining.delete('everstone')
  }

  const fillOrder: HeldItemId[] = ['destiny-knot', 'power-item']
  for (const id of fillOrder) {
    if (!remaining.has(id)) continue
    const demand = byId.get(id)
    const free = freeParents()
    if (!demand || free.length === 0) continue
    if (assignTo(free[0], demand)) {
      remaining.delete(id)
    }
  }

  if (remaining.size === 0) return undefined

  const unassigned = [...remaining]
    .map((id) => byId.get(id)?.label)
    .filter(Boolean)
  const assigned = parents
    .map((parent) => parent.heldItem)
    .filter(Boolean)

  let message = `Only two held-item slots exist (one per parent). Assigned: ${
    assigned.length > 0 ? assigned.join(', ') : 'none'
  }. Could not also fit: ${unassigned.join(', ')}.`

  if (remaining.has('destiny-knot') || remaining.has('power-item')) {
    message +=
      ' Destiny Knot spreads five IVs while a power item guarantees one specific stat — which matters more depends on whether you need the spread or a locked stat.'
  }

  return { severity: 'warning', message }
}

function applyNatureAbility(
  parent: ParentRequirement,
  game: GameData,
  ruleset: Ruleset,
  species: SpeciesEggData,
  target: DaycareTarget,
) {
  if (wantsNature(target, ruleset) && ruleset.natureLock.method !== 'none') {
    parent.mustHaveNature = target.nature
    for (const flag of natureAcquisitionFlags(game, target.nature)) {
      pushAcquisition(parent, flag)
    }
  }
  if (wantsAbility(target, ruleset, species)) {
    parent.mustHaveAbility = target.ability
    const abilityFlag = abilityAcquisitionFlag(
      game,
      ruleset,
      species,
      target.ability,
    )
    if (abilityFlag) pushAcquisition(parent, abilityFlag)
  }
}

function buildSpeciesPairStrategy(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
): PairingStrategy {
  const natureWanted = wantsNature(target, ruleset)
  const abilityWanted = wantsAbility(target, ruleset, species)
  const abilityNeedsFemale =
    abilityWanted && ruleset.abilityInheritance.maleOrGenderlessNeedsDitto
  const passers = eggMovePasserSpecies(game, target.species, target.eggMoves)
  const externalPassers = passers.filter((name) => name !== target.species)
  const useExternalCarrier =
    target.eggMoves.length > 0 && externalPassers.length > 0

  const parentA: ParentRequirement = {
    role: 'A',
    species: [target.species],
  }
  applyNatureAbility(parentA, game, ruleset, species, target)

  // Recompute gender from what the target actually forces — do not assert.
  if (natureWanted || useExternalCarrier) {
    parentA.gender = 'female'
    parentA.genderReason = genderReasonFemaleSpeciesHolder(target.species)
  } else if (abilityNeedsFemale) {
    parentA.gender = 'female'
    parentA.genderReason =
      'Female because a male or genderless parent can only pass its ability when paired with Ditto.'
  }

  const parentB: ParentRequirement = {
    role: 'B',
    species: useExternalCarrier ? externalPassers : [target.species],
  }

  if (useExternalCarrier) {
    parentB.gender = 'male'
    parentB.genderReason = genderReasonMaleExternalCarrier(externalPassers)
    parentB.mustKnow = [...target.eggMoves]
    const passerList =
      externalPassers.length <= 3
        ? externalPassers.join(', ')
        : `${externalPassers.slice(0, 3).join(', ')} (+${externalPassers.length - 3} more)`
    const moveList = target.eggMoves.join(', ')
    const how =
      game.eggMoveAcquisition?.how ??
      "Catch or hatch a parent that already knows the move, or copy it with this game's egg-move alternative."
    pushAcquisition(parentB, {
      severity: 'info',
      message: `Egg moves are not level-up moves for ${target.species}. Concrete passers in this game: ${passerList}. ${how} Need: ${moveList}.`,
    })
  } else if (natureWanted || abilityNeedsFemale) {
    parentB.gender = 'male'
    parentB.genderReason = genderReasonMaleSameSpeciesPartner()
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), false)

  let acquisitionCost: string
  if (useExternalCarrier) {
    acquisitionCost = natureWanted
      ? `one ${target.species} with the target nature, plus a male ${target.eggMoves.join('/')} carrier`
      : `one ${target.species}, plus a male ${target.eggMoves.join('/')} carrier`
  } else {
    acquisitionCost = natureWanted
      ? `two ${target.species}, one with the target nature`
      : `two ${target.species}`
  }

  const tradeoff = useExternalCarrier
    ? 'No consolidation prerequisite, but the egg-move carrier must be male or eggs hatch as that species.'
    : 'Pairs two of the target line — held items and hatching match the Ditto route.'

  return {
    id: 'species-pair',
    label: 'Species pair',
    parents,
    acquisitionCost,
    tradeoff,
  }
}

function buildDittoPairStrategy(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
): PairingStrategy {
  const natureWanted = wantsNature(target, ruleset)
  const unconstrained = isUnconstrainedTarget(target, ruleset, species)
  const fatherOnlyMoves =
    target.eggMoves.length > 0 &&
    ruleset.eggMoveEligibleParents === 'male-only'
  const hasMoveAlternative = Boolean(game.eggMoveAlternative)

  const parentA: ParentRequirement = {
    role: 'A',
    species: [target.species],
  }
  applyNatureAbility(parentA, game, ruleset, species, target)

  if (fatherOnlyMoves) {
    parentA.gender = 'male'
    parentA.genderReason = genderReasonMaleEggMoveFather()
  }

  if (target.eggMoves.length > 0) {
    parentA.mustKnow = [...target.eggMoves]
    const alt = game.eggMoveAlternative
    const passers = eggMovePasserSpecies(game, target.species, target.eggMoves)
    const passerList =
      passers.length === 0
        ? null
        : passers.length <= 3
          ? passers.join(', ')
          : `${passers.slice(0, 3).join(', ')} (+${passers.length - 3} more)`
    const picnicPartner = passerList
      ? ` Picnic with a partner that already knows the move — in this game that includes ${passerList}.`
      : ''
    const how =
      alt != null
        ? `Consolidate ${target.eggMoves.join(', ')} onto ${target.species} first using ${alt.name}: ${alt.howItWorks}${picnicPartner} Ditto only knows Transform and cannot pass egg moves.`
        : fatherOnlyMoves
          ? `This route needs a male ${target.species} that already knows ${target.eggMoves.join(', ')}. In this game that usually means hatching one from the species-pair route first (only the father passes egg moves); there is no separate teach-onto-the-line mechanic. Ditto only knows Transform and cannot pass egg moves.`
          : `This route needs a ${target.species} that already knows ${target.eggMoves.join(', ')}. In this game that usually means getting the moves via the species-pair route first; there is no separate teach-onto-the-line mechanic. Ditto only knows Transform and cannot pass egg moves.`
    pushAcquisition(parentA, {
      severity: 'info',
      message: how,
    })
  }

  const parentB: ParentRequirement = {
    role: 'B',
    species: ['Ditto'],
  }
  // Ditto sourcing is noise on unconstrained / ordinary routes — only when
  // the player must actually go get one for this plan.
  if (!unconstrained && game.ditto.obtainedAt) {
    pushAcquisition(parentB, {
      severity: 'info',
      message: `Obtain Ditto: ${game.ditto.obtainedAt.replace(/\.+$/, '')}.`,
    })
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), true)

  let acquisitionCost: string
  if (target.eggMoves.length > 0) {
    if (hasMoveAlternative) {
      acquisitionCost = natureWanted
        ? `one ${target.species} with the target nature and ${target.eggMoves.join('/')} consolidated, plus a Ditto`
        : `one ${target.species} with ${target.eggMoves.join('/')} consolidated, plus a Ditto`
    } else if (fatherOnlyMoves) {
      acquisitionCost = natureWanted
        ? `one male ${target.species} with the target nature that already knows ${target.eggMoves.join('/')}, plus a Ditto`
        : `one male ${target.species} that already knows ${target.eggMoves.join('/')}, plus a Ditto`
    } else {
      acquisitionCost = natureWanted
        ? `one ${target.species} with the target nature that already knows ${target.eggMoves.join('/')}, plus a Ditto`
        : `one ${target.species} that already knows ${target.eggMoves.join('/')}, plus a Ditto`
    }
  } else {
    acquisitionCost = natureWanted
      ? `one ${target.species} with the target nature, plus a Ditto`
      : `one ${target.species}, plus a Ditto`
  }

  const moveNote =
    target.eggMoves.length === 0
      ? `${target.species} covers the spread; Ditto pairs with anything.`
      : hasMoveAlternative
        ? `Requires consolidating ${target.eggMoves.join(', ')} onto ${target.species} first, then one parent covers nature/ability/moves.`
        : `Depends on already having a ${target.species} with ${target.eggMoves.join(', ')} — usually from the species-pair route first.`

  return {
    id: 'ditto-pair',
    label: 'Ditto pair',
    parents,
    acquisitionCost,
    tradeoff: `${moveNote} Ditto cannot carry egg moves itself.`,
  }
}

function buildDittoOnlyStrategy(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
): PairingStrategy {
  const natureWanted = wantsNature(target, ruleset)

  const parentA: ParentRequirement = {
    role: 'A',
    species: [target.species],
  }
  applyNatureAbility(parentA, game, ruleset, species, target)
  if (target.eggMoves.length > 0) {
    parentA.mustKnow = [...target.eggMoves]
  }

  const parentB: ParentRequirement = {
    role: 'B',
    species: ['Ditto'],
  }
  if (game.ditto.obtainedAt) {
    pushAcquisition(parentB, {
      severity: 'info',
      message: `Obtain Ditto: ${game.ditto.obtainedAt.replace(/\.+$/, '')}.`,
    })
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), true)

  const acquisitionCost = natureWanted
    ? `one ${target.species} with the target nature, plus a Ditto`
    : `one ${target.species}, plus a Ditto`

  return {
    id: 'ditto-only',
    label: 'Ditto pair',
    parents,
    acquisitionCost,
    tradeoff: `${target.species} can only pair with Ditto in this game.`,
  }
}

/** Parents you must obtain for the route — each ParentRequirement counts as one. */
function acquisitionParentCount(strategy: PairingStrategy): number {
  return strategy.parents.length
}

/**
 * Recommend the route with fewest parents to acquire. When tied, recommend
 * neither — a badge without a real edge is just first position.
 */
function applyRouteRecommendations(strategies: PairingStrategy[]): {
  strategies: PairingStrategy[]
  routesEquivalent: boolean
} {
  if (strategies.length === 0) {
    return { strategies, routesEquivalent: false }
  }
  if (strategies.length === 1) {
    const only = strategies[0]!
    return {
      strategies: [
        {
          ...only,
          recommended: true,
          recommendReason: 'Only viable pairing route in this game.',
        },
      ],
      routesEquivalent: false,
    }
  }

  const counts = strategies.map(acquisitionParentCount)
  const min = Math.min(...counts)
  const winners = strategies.filter(
    (_, index) => counts[index] === min,
  )

  if (winners.length !== 1) {
    return {
      strategies: strategies.map((strategy) => ({
        ...strategy,
        recommended: undefined,
        recommendReason: undefined,
      })),
      routesEquivalent: true,
    }
  }

  const winnerId = winners[0]!.id
  return {
    strategies: strategies.map((strategy) =>
      strategy.id === winnerId
        ? {
            ...strategy,
            recommended: true,
            recommendReason: 'Fewer parents to obtain',
          }
        : {
            ...strategy,
            recommended: undefined,
            recommendReason: undefined,
          },
    ),
    routesEquivalent: false,
  }
}

function canOfferDittoPair(game: GameData, _target: DaycareTarget): boolean {
  // Ditto can't carry egg moves itself, but a non-Ditto parent that already
  // knows them can — including in eggs-only eras where that parent usually
  // comes from the species-pair route first (circular to bootstrap, valid later).
  return game.ditto.available
}

function genderReasonMaleEggMoveFather(): string {
  return 'Male because only the father passes egg moves in this game.'
}

function resolveStrategies(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
  dittoOnly: boolean,
): {
  strategies: PairingStrategy[]
  routesEquivalent: boolean
  excludedStrategies: Array<{ id: string; label: string; reason: string }>
} {
  const excludedStrategies: Array<{
    id: string
    label: string
    reason: string
  }> = []

  if (dittoOnly) {
    const abilityExclusion = speciesPairAbilityExclusion(
      ruleset,
      species,
      target,
    )
    if (abilityExclusion) {
      excludedStrategies.push({
        id: 'species-pair',
        label: 'Species pair',
        reason: abilityExclusion,
      })
    } else {
      excludedStrategies.push({
        id: 'species-pair',
        label: 'Species pair',
        reason: `${target.species} can only pair with Ditto in this game.`,
      })
    }
    const recommended = applyRouteRecommendations([
      buildDittoOnlyStrategy(game, ruleset, target, species),
    ])
    return { ...recommended, excludedStrategies }
  }

  const strategies: PairingStrategy[] = []
  const abilityExclusion = speciesPairAbilityExclusion(
    ruleset,
    species,
    target,
  )
  if (abilityExclusion) {
    excludedStrategies.push({
      id: 'species-pair',
      label: 'Species pair',
      reason: abilityExclusion,
    })
  } else {
    strategies.push(buildSpeciesPairStrategy(game, ruleset, target, species))
  }

  if (canOfferDittoPair(game, target)) {
    strategies.push(buildDittoPairStrategy(game, ruleset, target, species))
  } else if (abilityExclusion && !game.ditto.available) {
    // Ability needs Ditto but Ditto isn't obtainable — handled by empty strategies.
  }

  const recommended = applyRouteRecommendations(strategies)
  return { ...recommended, excludedStrategies }
}

function describeParentBrief(parent: ParentRequirement): string {
  const parts: string[] = []
  if (parent.gender) parts.push(parent.gender)
  parts.push(parent.species.join('/'))
  if (parent.mustHaveNature) parts.push(parent.mustHaveNature)
  if (parent.mustHaveAbility) parts.push(parent.mustHaveAbility)
  if (parent.mustKnow?.length) {
    parts.push(`knows ${parent.mustKnow.join(', ')}`)
  }
  if (parent.heldItem) parts.push(`holding ${parent.heldItem}`)
  return parts.join(', ')
}

function buildAssembleStep(
  game: GameData,
  ruleset: Ruleset,
  speciesName: string,
  species: SpeciesEggData,
  parents: ParentRequirement[],
  dittoPair: boolean,
): StepDraft {
  const offspring = species.hatchesInto
  const a = parents.find((parent) => parent.role === 'A')
  const b = parents.find((parent) => parent.role === 'B')

  const parts: string[] = []
  if (a && b) {
    parts.push(
      `Pair these two: ${describeParentBrief(a)}; and ${describeParentBrief(b)}.`,
    )
  }

  parts.push(`Eggs hatch as ${offspring} at level ${ruleset.hatchLevel}.`)

  if (dittoPair && game.ditto.obtainedAt) {
    parts.push(
      `Ditto sourcing: ${game.ditto.obtainedAt.replace(/\.+$/, '')}.`,
    )
  }

  if (speciesName !== offspring) {
    parts.push(
      `If you need ${speciesName} specifically, hatch ${offspring} and evolve it.`,
    )
  }

  return {
    id: 'assemble',
    instruction: parts.join(' '),
  }
}

function buildBlockedPairStep(speciesName: string): StepDraft {
  return {
    id: 'assemble',
    instruction: `${speciesName} can only pair with Ditto in this game, and Ditto is not obtainable here.`,
    ruleFlags: [
      {
        severity: 'blocking',
        message: `No valid pair exists for ${speciesName} — Ditto is unavailable in this game.`,
      },
    ],
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

function buildNatureConfirmStep(
  ruleset: Ruleset,
  nature: string,
  parents: ParentRequirement[],
): StepDraft | null {
  const lock = ruleset.natureLock
  // method "none" is a form-level constraint — never a plan step.
  if (lock.method === 'none') return null

  const holder = parents.find((parent) => parent.heldItem === 'Everstone')
  const where = holder
    ? `Parent ${holder.role}${holder.gender ? ` (${holder.gender})` : ''}`
    : lock.holder === 'either-parent'
      ? 'either parent'
      : 'the female parent or Ditto'

  if (lock.method === 'everstone-guaranteed') {
    return {
      id: 'nature',
      instruction: `Confirm the Everstone is on ${where} to guarantee the hatch inherits ${nature}.`,
    }
  }

  return {
    id: 'nature',
    instruction: `Confirm the Everstone is on ${where} for a 50% chance the hatch inherits ${nature}.`,
    ruleFlags: [
      {
        severity: 'warning',
        message: 'Everstone only gives a 50% nature chance in this game.',
      },
    ],
  }
}

function buildAbilityBlockStep(
  ruleset: Ruleset,
  speciesName: string,
  species: SpeciesEggData,
  ability: string,
): StepDraft | null {
  if (
    !isAbilityHidden(species, ability) ||
    ruleset.abilityInheritance.hiddenAbilityViaEggs
  ) {
    return null
  }

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

/**
 * Quote the per-egg rate — ability inheritance is never a certainty.
 * Only called when inheritance exists and the target specifies an ability.
 */
function buildAbilityInheritStep(
  ruleset: Ruleset,
  species: SpeciesEggData,
  ability: string,
): StepDraft | null {
  const hidden = isAbilityHidden(species, ability)
  const { standardOdds, hiddenOdds } = ruleset.abilityInheritance
  const odds = hidden ? hiddenOdds : standardOdds
  const percent = formatOddsPercent(odds)
  const missHint =
    odds <= 0.65
      ? ' Roughly two in five eggs miss.'
      : ' Plan on hatching more than one egg.'

  const flags: RuleFlag[] = []
  if (hidden) {
    flags.push({
      severity: 'info',
      message: `Hidden abilities pass at a lower rate than standard ones (${formatOddsPercent(hiddenOdds)} per egg vs ${formatOddsPercent(standardOdds)}).`,
    })
  }

  return {
    id: 'ability',
    instruction: `Confirm Parent A has ${ability}. About ${percent} of eggs inherit that ability; the rest roll a different slot.${missHint}`,
    ruleFlags: flags.length > 0 ? flags : undefined,
  }
}

function buildEggMoveStepsForStrategy(
  game: GameData,
  ruleset: Ruleset,
  speciesName: string,
  eggMoves: string[],
  strategyId: string,
): StepDraft[] {
  if (!ruleset.eggMovesExist || eggMoves.length === 0) return []

  const steps: StepDraft[] = []
  const passers = eggMovePasserSpecies(game, speciesName, eggMoves)
  const passerExamples =
    passers.length === 0
      ? null
      : passers.length <= 3
        ? formatSpeciesList(passers)
        : `${passers.slice(0, 3).join(', ')} (+${passers.length - 3} more)`

  if (strategyId === 'ditto-pair' || strategyId === 'ditto-only') {
    if (game.eggMoveAlternative) {
      const alt = game.eggMoveAlternative
      const partnerNote = passerExamples
        ? ` Picnic with a partner that already knows them — in this game that includes ${passerExamples}.`
        : ''
      steps.push({
        id: 'consolidate-egg-moves',
        instruction: `First consolidate ${eggMoves.join(', ')} onto ${speciesName} using ${alt.name}: ${alt.howItWorks}${partnerNote} Ditto cannot carry egg moves.`,
      })
    } else {
      const fatherOnly = ruleset.eggMoveEligibleParents === 'male-only'
      steps.push({
        id: 'egg-moves-prerequisite',
        instruction: fatherOnly
          ? `Pair a male ${speciesName} that already knows ${eggMoves.join(', ')} with Ditto. That ${speciesName} usually comes from the species-pair route first — only the father passes egg moves here, and there is no other teach-onto-the-line mechanic.`
          : `Pair a ${speciesName} that already knows ${eggMoves.join(', ')} with Ditto. That ${speciesName} usually comes from the species-pair route first — there is no other teach-onto-the-line mechanic here.`,
      })
    }
    return steps
  }

  const catalog = game.eggMoves[speciesName] ?? []
  const fatherOnly = ruleset.eggMoveEligibleParents === 'male-only'
  const parentRole = fatherOnly ? 'the father' : 'a parent'
  const sourceNote = passerExamples
    ? ` Passers in this game include ${passerExamples}.`
    : ''

  steps.push({
    id: 'egg-moves',
    instruction: fatherOnly
      ? `The father must know ${eggMoves.join(', ')}.${sourceNote}`
      : `Ensure ${parentRole} knows ${eggMoves.join(', ')}.${sourceNote}`,
  })

  for (const move of eggMoves) {
    const entry = catalog.find((item) => item.move === move)
    const sources = entry?.parentSpecies ?? []

    const indirectSources = sources.filter((source) => {
      if (source === speciesName) return false
      const sourceGroups = eggGroupsForSpecies(game, source)
      if (sourceGroups.length === 0) return false
      return !sharesEggGroup(game, speciesName, source)
    })

    for (const source of indirectSources) {
      steps.push({
        id: `egg-move-${slug(move)}-via-${slug(source)}`,
        instruction: `First get ${move} onto an intermediate parent from ${source}, then have ${fatherOnly ? 'the father' : 'the egg-move parent'} pass ${move} into the ${speciesName} line.`,
      })
    }
  }

  if (
    ruleset.eggMoveMethod === 'eggs-or-alternative' &&
    game.eggMoveAlternative
  ) {
    const alt = game.eggMoveAlternative
    const partnerNote = passerExamples
      ? ` Picnic with a partner that already knows them — in this game that includes ${passerExamples}.`
      : ''
    steps.push({
      id: 'egg-move-alternative',
      instruction: `Alternatively, use ${alt.name} for ${eggMoves.join(', ')}: ${alt.howItWorks}${partnerNote}`,
    })
  }

  return steps
}

function hyperTrainingAllMaxFlag(
  game: GameData,
  ruleset: Ruleset,
): RuleFlag {
  const level = ruleset.hyperTraining.levelRequired
  const access = game.hyperTrainingAccess
  const tradeOff =
    "Hyper Training doesn't change the IVs a Pokémon passes down, so it suits a finished battler while hatching suits a parent you'll pair from again."

  if (!access) {
    return {
      severity: 'info',
      message: `${tradeOff} A Gold Bottle Cap can max every IV at level ${level}.`,
    }
  }

  const costSentence =
    access.effort === 'routine'
      ? `A Gold Bottle Cap maxes every IV at level ${level}, and getting one is routine here (${access.goldBottleCap}).`
      : access.effort === 'grindy'
        ? `A Gold Bottle Cap maxes every IV at level ${level}, though getting one is a grind here (${access.goldBottleCap}).`
        : `A Gold Bottle Cap maxes every IV at level ${level}, but Gold Bottle Caps are rare here (${access.goldBottleCap}).`

  return {
    severity: 'info',
    message: `${tradeOff} ${costSentence}`,
  }
}

function itemConflictFromParents(
  parents: ParentRequirement[],
  demands: HeldItemDemand[],
): RuleFlag | undefined {
  if (demands.length <= 2) return undefined
  const held = parents.map((parent) => parent.heldItem).filter(Boolean)
  const demandLabels = demands.map((demand) => demand.label)
  const missing = demandLabels.filter((label) => !held.includes(label))
  if (missing.length === 0) return undefined

  return {
    severity: 'warning',
    message: `Only two held-item slots exist (one per parent). Assigned: ${
      held.length > 0 ? held.join(', ') : 'none'
    }. Could not also fit: ${missing.join(', ')}. Destiny Knot spreads five IVs while a power item guarantees one specific stat — which matters more depends on whether you need the spread or a locked stat.`,
  }
}

function buildIvStep(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  parents: ParentRequirement[],
): StepDraft {
  const { ivInheritance, hyperTraining } = ruleset
  const flags: RuleFlag[] = []
  const wantsPower = Boolean(target.wantsPowerItem)

  if (hyperTraining.available && isAllMaxIvs(target.ivs, ivInheritance.maxIv)) {
    flags.push(hyperTrainingAllMaxFlag(game, ruleset))
  }
  if (hyperTraining.available && hasZeroIv(target.ivs)) {
    flags.push({
      severity: 'info',
      message:
        'Hyper Training only raises IVs and can never produce a 0. A 0 requires a parent that already has 0 in that stat. Hyper Trained parents pass their innate IVs, not the trained ones.',
    })
  }

  const demands = collectHeldItemDemands(ruleset, target)
  const conflict = itemConflictFromParents(parents, demands)
  if (conflict) flags.push(conflict)

  let instruction = `Plan IV inheritance around ${ivInheritance.baseCountInherited} IVs passed from the parents by default (max IV ${ivInheritance.maxIv}).`
  if (ivInheritance.destinyKnotAvailable) {
    instruction += ` Destiny Knot raises inherited IVs from ${ivInheritance.baseCountInherited} to ${ivInheritance.destinyKnotBoostedCount}.`
  }
  if (wantsPower && ivInheritance.powerItemsAvailable) {
    instruction +=
      ' A power item locks one specific parent IV into the hatch.'
  }
  if (parents.some((parent) => parent.heldItem)) {
    instruction += ' Held items are already assigned on the parent pair above.'
  }

  return {
    id: 'iv-base',
    instruction,
    ruleFlags: flags.length > 0 ? flags : undefined,
  }
}

function buildStepsForStrategy(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
  strategy: PairingStrategy,
): PlanStep[] {
  const unconstrained = isUnconstrainedTarget(target, ruleset, species)
  if (unconstrained) {
    const drafts: StepDraft[] = [
      {
        id: 'assemble',
        instruction: `Pair two ${target.species} and hatch. Eggs hatch at level ${ruleset.hatchLevel}.`,
      },
    ]
    return finalizeSteps(drafts)
  }

  const dittoPair =
    strategy.id === 'ditto-pair' || strategy.id === 'ditto-only'
  const drafts: StepDraft[] = []

  drafts.push(
    buildAssembleStep(
      game,
      ruleset,
      target.species,
      species,
      strategy.parents,
      dittoPair,
    ),
  )

  const incense = buildIncenseStep(species)
  if (incense) drafts.push(incense)

  if (wantsNature(target, ruleset)) {
    const natureStep = buildNatureConfirmStep(
      ruleset,
      target.nature,
      strategy.parents,
    )
    if (natureStep) drafts.push(natureStep)
  }

  if (wantsAbility(target, ruleset, species)) {
    const abilityBlock = buildAbilityBlockStep(
      ruleset,
      target.species,
      species,
      target.ability,
    )
    if (abilityBlock) {
      drafts.push(abilityBlock)
    } else {
      const abilityStep = buildAbilityInheritStep(
        ruleset,
        species,
        target.ability,
      )
      if (abilityStep) drafts.push(abilityStep)
    }
  }

  drafts.push(
    ...buildEggMoveStepsForStrategy(
      game,
      ruleset,
      target.species,
      target.eggMoves,
      strategy.id,
    ),
  )
  drafts.push(buildIvStep(game, ruleset, target, strategy.parents))

  return finalizeSteps(drafts)
}

const SHINY_TIER_META: Record<
  'base' | 'masuda' | 'masudaPlusCharm',
  { label: string; requiresMasuda: boolean; requiresCharm: boolean }
> = {
  base: {
    label: 'Base egg odds',
    requiresMasuda: false,
    requiresCharm: false,
  },
  masuda: {
    label: 'Masuda Method',
    requiresMasuda: true,
    requiresCharm: false,
  },
  masudaPlusCharm: {
    label: 'Masuda Method + Shiny Charm',
    requiresMasuda: true,
    requiresCharm: true,
  },
}

function buildShinyPayload(game: GameData): ShinyOdds | undefined {
  const modifiers = game.shinyEggModifiers
  const tiersData = modifiers?.oddsTiers
  if (!modifiers || !tiersData) return undefined

  const tiers: ShinyOddsTier[] = []
  for (const id of ['base', 'masuda', 'masudaPlusCharm'] as const) {
    const meta = SHINY_TIER_META[id]
    if (meta.requiresMasuda && !modifiers.masudaMethodAvailable) continue
    if (meta.requiresCharm && !modifiers.shinyCharmAvailable) continue
    if (id === 'masudaPlusCharm' && !modifiers.shinyCharmStacksWithMasuda) {
      continue
    }
    const tier = tiersData[id]
    if (!tier) continue
    tiers.push({
      id,
      label: meta.label,
      odds: tier.odds,
      approximateEggs: tier.approximateEggs,
    })
  }
  if (tiers.length === 0) return undefined
  return { tiers }
}

/** Steps for a chosen strategy — used by the UI when switching routes. */
export function stepsForStrategy(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  strategy: PairingStrategy,
): PlanStep[] {
  const species = game.species[target.species]
  if (!species) return []
  return buildStepsForStrategy(game, ruleset, target, species, strategy)
}

export function planDaycare(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
): DaycarePlan {
  const featureGates = game.featureGates ? [...game.featureGates] : []

  const species = game.species[target.species]
  if (!species) {
    return {
      strategies: [],
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

  const dittoOnly = needsDittoOnly(species.genderRatio)

  if (dittoOnly && !game.ditto.available) {
    return {
      strategies: [],
      featureGates,
      blocked: true,
      steps: finalizeSteps([buildBlockedPairStep(target.species)]),
    }
  }

  const { strategies, routesEquivalent, excludedStrategies } =
    resolveStrategies(game, ruleset, target, species, dittoOnly)
  const recommended =
    strategies.find((strategy) => strategy.recommended) ?? strategies[0]

  if (strategies.length === 0) {
    const abilityExclusion = excludedStrategies.find(
      (entry) => entry.id === 'species-pair',
    )
    return {
      strategies: [],
      excludedStrategies:
        excludedStrategies.length > 0 ? excludedStrategies : undefined,
      featureGates,
      blocked: true,
      steps: finalizeSteps([
        {
          id: 'assemble',
          instruction:
            abilityExclusion?.reason ??
            `No viable pairing route can produce this target in this game.`,
          ruleFlags: [
            {
              severity: 'blocking',
              message:
                abilityExclusion?.reason ??
                'No viable pairing route exists for this target.',
            },
          ],
        },
      ]),
    }
  }

  return {
    strategies,
    routesEquivalent: routesEquivalent || undefined,
    excludedStrategies:
      excludedStrategies.length > 0 ? excludedStrategies : undefined,
    featureGates,
    blocked: false,
    steps: recommended
      ? buildStepsForStrategy(game, ruleset, target, species, recommended)
      : [],
    shiny: target.wantsShiny ? buildShinyPayload(game) : undefined,
  }
}
