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
import type { Reason } from '../lib/reason'

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
  genderReason?: Reason[]
  mustKnow?: string[]
  mustHaveAbility?: string
  mustHaveNature?: string
  heldItem?: string
  /** Why this held item is assigned — required whenever heldItem is set. */
  heldItemReason?: Reason
  /** Masuda — origin language must differ from the other parent. */
  mustOriginateFromDifferentLanguage?: boolean
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
  id: 'base' | 'shinyCharm' | 'masuda' | 'masudaPlusCharm'
  label: string
  odds: string
  approximateEggs: number
  /** Shown once per fact — don't repeat Masuda or Charm copy across rows. */
  context?: string
}

export type ShinyOdds = {
  tiers: ShinyOddsTier[]
  /** Present when this game has no egg-shiny boost (no Masuda, no Charm). */
  noBoostsReason?: string
  /** Shininess is locked when the egg is received, not when it hatches. */
  determinedOnReceive: string
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
  reason: Reason
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

/** True if the name is a species key or appears in any egg-group membership list. */
function isKnownSpecies(game: GameData, name: string): boolean {
  if (Object.hasOwn(game.species, name)) return true
  return Object.values(game.eggGroups).some((members) => members.includes(name))
}

/**
 * Empty membership is always a data gap today — the inverted index cannot
 * represent a species that legitimately has no groups. Known vs unknown
 * changes only the copy.
 */
function eggGroupMembershipWarning(
  game: GameData,
  name: string,
): RuleFlag | undefined {
  if (eggGroupsForSpecies(game, name).length > 0) return undefined
  return {
    severity: 'warning',
    message: isKnownSpecies(game, name)
      ? `${name} is in the catalog but has no egg-group membership recorded`
      : `no egg-group data is held for ${name}`,
  }
}

function applyEggGroupLookupWarnings(
  game: GameData,
  parent: ParentRequirement,
  speciesName: string,
  eggMoves: string[],
) {
  const catalog = game.eggMoves[speciesName] ?? []
  const seen = new Set<string>()
  for (const move of eggMoves) {
    const sources =
      catalog.find((item) => item.move === move)?.parentSpecies ?? []
    for (const source of sources) {
      if (seen.has(source)) continue
      seen.add(source)
      const warning = eggGroupMembershipWarning(game, source)
      if (warning) pushAcquisition(parent, warning)
    }
  }
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

/** Masuda exists on this ruleset (gen 4+, introduced in Diamond/Pearl). */
function masudaAvailable(ruleset: Ruleset): boolean {
  return ruleset.masudaMethod != null
}

/** Shiny is on and this ruleset has a different-language parent boost. */
function wantsMasuda(target: DaycareTarget, ruleset: Ruleset): boolean {
  return Boolean(target.wantsShiny) && masudaAvailable(ruleset)
}

/**
 * No nature lock, ability inheritance, egg moves, or specific IVs.
 * Masuda may still add a parent constraint on top of this.
 */
function isAttributeUnconstrained(
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

function isUnconstrainedTarget(
  target: DaycareTarget,
  ruleset: Ruleset,
  species: SpeciesEggData,
): boolean {
  return (
    isAttributeUnconstrained(target, ruleset, species) &&
    !wantsMasuda(target, ruleset)
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

function masudaAcquisitionFlag(game: GameData): RuleFlag {
  const how =
    game.masudaAcquisition?.how ??
    'You may already have one — a pair from different-language games would count. Otherwise trade for one, or import from a cartridge saved in another language.'
  return {
    severity: 'info',
    message: how,
  }
}

/**
 * Attach the different-language constraint to one parent: Ditto when the
 * route has one (reusable across projects), otherwise the target-species parent.
 */
function applyMasudaConstraint(
  parents: ParentRequirement[],
  game: GameData,
  target: DaycareTarget,
  ruleset: Ruleset,
) {
  if (!wantsMasuda(target, ruleset)) return
  const ditto = parents.find((parent) => parent.species.includes('Ditto'))
  const holder =
    ditto ??
    parents.find((parent) => parent.role === 'A') ??
    parents[0]
  if (!holder) return
  holder.mustOriginateFromDifferentLanguage = true
  pushAcquisition(holder, masudaAcquisitionFlag(game))
}

function withMasudaAcquisitionCost(
  cost: string,
  parents: ParentRequirement[],
): string {
  const foreign = parents.find(
    (parent) => parent.mustOriginateFromDifferentLanguage,
  )
  if (!foreign) return cost
  if (foreign.species.includes('Ditto')) {
    if (/plus a Ditto$/.test(cost)) {
      return cost.replace(
        /plus a Ditto$/,
        'plus a Ditto whose origin language differs from its partner',
      )
    }
    return `${cost}; Ditto whose origin language differs from its partner`
  }
  if (/^two /.test(cost)) {
    return `${cost}; one whose origin language differs from its partner`
  }
  const name = foreign.species[0] ?? 'parent'
  return `${cost}; the ${name} whose origin language differs from its partner`
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

function femaleSpeciesHolder(offspringSpecies: string): Reason {
  return { code: 'female-species-holder', offspringSpecies }
}

function femaleAbilityNeedsDitto(): Reason {
  return { code: 'female-ability-needs-ditto' }
}

function maleSameSpeciesPartner(): Reason {
  return { code: 'male-same-species-partner' }
}

function maleExternalCarrier(carrierSpecies: string[]): Reason {
  return { code: 'male-external-carrier', carrierSpecies }
}

function maleEggMoveEligible(): Reason {
  return { code: 'male-egg-move-eligible' }
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
          ? { code: 'everstone-guaranteed', nature: target.nature }
          : { code: 'everstone-chance', nature: target.nature },
    })
  }

  if (hasSpecificIvTargets(ivs) && ruleset.ivInheritance.destinyKnotAvailable) {
    const { baseCountInherited, destinyKnotBoostedCount } = ruleset.ivInheritance
    demands.push({
      id: 'destiny-knot',
      label: 'Destiny Knot',
      placement: 'either',
      reason: {
        code: 'destiny-knot-iv',
        baseCountInherited,
        destinyKnotBoostedCount,
      },
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
      reason: { code: 'power-item-iv' },
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
            if (!natureParent.genderReason?.length) {
              natureParent.genderReason = [
                femaleSpeciesHolder(
                  natureParent.species[0] ?? 'the target',
                ),
              ]
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
    parentA.genderReason = [femaleSpeciesHolder(target.species)]
  } else if (abilityNeedsFemale) {
    parentA.gender = 'female'
    parentA.genderReason = [femaleAbilityNeedsDitto()]
  }

  const parentB: ParentRequirement = {
    role: 'B',
    species: useExternalCarrier ? externalPassers : [target.species],
  }

  if (target.eggMoves.length > 0) {
    parentB.mustKnow = [...target.eggMoves]
    const passerList =
      externalPassers.length === 0
        ? null
        : externalPassers.length <= 3
          ? externalPassers.join(', ')
          : `${externalPassers.slice(0, 3).join(', ')} (+${externalPassers.length - 3} more)`
    const moveList = target.eggMoves.join(', ')
    const how =
      game.eggMoveAcquisition?.how ??
      "Catch or hatch a parent that already knows the move, or copy it with this game's egg-move alternative."
    const passerNote = passerList
      ? ` Concrete passers in this game: ${passerList}.`
      : ''
    pushAcquisition(parentB, {
      severity: 'info',
      message: `Egg moves are not level-up moves for ${target.species}.${passerNote} ${how} Need: ${moveList}.`,
    })
    applyEggGroupLookupWarnings(game, parentB, target.species, target.eggMoves)
  }

  const carrierGenderReasons: Reason[] = []
  if (useExternalCarrier) {
    carrierGenderReasons.push(maleExternalCarrier(externalPassers))
  }
  if (
    target.eggMoves.length > 0 &&
    ruleset.eggMoveEligibleParents === 'male-only'
  ) {
    carrierGenderReasons.push(maleEggMoveEligible())
  }
  if (carrierGenderReasons.length > 0) {
    parentB.gender = 'male'
    parentB.genderReason = carrierGenderReasons
  } else if (natureWanted || abilityNeedsFemale) {
    parentB.gender = 'male'
    parentB.genderReason = [maleSameSpeciesPartner()]
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), false)
  applyMasudaConstraint(parents, game, target, ruleset)

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
  acquisitionCost = withMasudaAcquisitionCost(acquisitionCost, parents)

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
    parentA.genderReason = [maleEggMoveEligible()]
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
    applyEggGroupLookupWarnings(game, parentA, target.species, target.eggMoves)
  }

  const parentB: ParentRequirement = {
    role: 'B',
    species: ['Ditto'],
  }
  // Ditto sourcing is noise on unconstrained / ordinary routes — only when
  // the player must actually go get one for this plan. Masuda replaces this
  // with different-language acquisition (a local Ditto is the wrong parent).
  if (
    !unconstrained &&
    !wantsMasuda(target, ruleset) &&
    game.ditto.obtainedAt
  ) {
    pushAcquisition(parentB, {
      severity: 'info',
      message: `Obtain Ditto: ${game.ditto.obtainedAt.replace(/\.+$/, '')}.`,
    })
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), true)
  applyMasudaConstraint(parents, game, target, ruleset)

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
  acquisitionCost = withMasudaAcquisitionCost(acquisitionCost, parents)

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
    applyEggGroupLookupWarnings(game, parentA, target.species, target.eggMoves)
  }

  const parentB: ParentRequirement = {
    role: 'B',
    species: ['Ditto'],
  }
  if (!wantsMasuda(target, ruleset) && game.ditto.obtainedAt) {
    pushAcquisition(parentB, {
      severity: 'info',
      message: `Obtain Ditto: ${game.ditto.obtainedAt.replace(/\.+$/, '')}.`,
    })
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), true)
  applyMasudaConstraint(parents, game, target, ruleset)

  const acquisitionCost = withMasudaAcquisitionCost(
    natureWanted
      ? `one ${target.species} with the target nature, plus a Ditto`
      : `one ${target.species}, plus a Ditto`,
    parents,
  )

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

function isDittoRoute(strategy: PairingStrategy): boolean {
  return strategy.id === 'ditto-pair' || strategy.id === 'ditto-only'
}

/**
 * Recommend the route with fewest parents to acquire. When tied, recommend
 * neither — a badge without a real edge is just first position.
 * Masuda flips this: a Ditto works with any species, so you can reuse it
 * for other hatches — strictly better than a foreign parent of the line.
 */
function applyRouteRecommendations(
  strategies: PairingStrategy[],
  preferForeignDitto = false,
): {
  strategies: PairingStrategy[]
  routesEquivalent: boolean
} {
  if (strategies.length === 0) {
    return { strategies, routesEquivalent: false }
  }

  if (preferForeignDitto) {
    const dittoRoute = strategies.find(isDittoRoute)
    if (dittoRoute) {
      return {
        strategies: strategies.map((strategy) =>
          strategy.id === dittoRoute.id
            ? {
                ...strategy,
                recommended: true,
                recommendReason:
                  'A Ditto works with any species, so you can reuse it for other hatches.',
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
    const recommended = applyRouteRecommendations(
      [buildDittoOnlyStrategy(game, ruleset, target, species)],
      wantsMasuda(target, ruleset),
    )
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
  }

  const recommended = applyRouteRecommendations(
    strategies,
    wantsMasuda(target, ruleset),
  )
  return { ...recommended, excludedStrategies }
}

function buildBlockedPairStep(speciesName: string): StepDraft {
  return {
    id: 'blocked-pair',
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

  const flags: RuleFlag[] = []
  if (hidden) {
    flags.push({
      severity: 'info',
      message: `Hidden abilities pass at a lower rate than standard ones (${formatOddsPercent(hiddenOdds)} per egg vs ${formatOddsPercent(standardOdds)}).`,
    })
  }

  return {
    id: 'ability',
    instruction: `About ${percent} of eggs inherit ${ability}; the rest roll a different slot.`,
    ruleFlags: flags.length > 0 ? flags : undefined,
  }
}

function buildEggMoveStepsForStrategy(
  game: GameData,
  ruleset: Ruleset,
  speciesName: string,
  eggMoves: string[],
): StepDraft[] {
  if (!ruleset.eggMovesExist || eggMoves.length === 0) return []

  const steps: StepDraft[] = []
  const catalog = game.eggMoves[speciesName] ?? []
  const passer =
    ruleset.eggMoveEligibleParents === 'male-only'
      ? 'the father'
      : 'the egg-move parent'

  for (const move of eggMoves) {
    const entry = catalog.find((item) => item.move === move)
    const sources = entry?.parentSpecies ?? []

    const indirectSources = sources.filter((source) => {
      if (source === speciesName) return false
      if (eggGroupMembershipWarning(game, source)) return false
      return !sharesEggGroup(game, speciesName, source)
    })

    for (const source of indirectSources) {
      steps.push({
        id: `egg-move-${slug(move)}-via-${slug(source)}`,
        instruction: `First get ${move} onto an intermediate parent from ${source}, then have ${passer} pass ${move} into the ${speciesName} line.`,
      })
    }
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

function heldItemConflictFlag(
  parents: ParentRequirement[],
  ruleset: Ruleset,
  target: DaycareTarget,
): RuleFlag | undefined {
  return itemConflictFromParents(
    parents,
    collectHeldItemDemands(ruleset, target),
  )
}

function buildIvStep(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
): StepDraft | null {
  if (!hasSpecificIvTargets(target.ivs) && !Boolean(target.wantsPowerItem)) {
    return null
  }

  const { ivInheritance, hyperTraining } = ruleset
  const flags: RuleFlag[] = []

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

  return {
    id: 'iv-base',
    instruction: `Plan IV inheritance around ${ivInheritance.baseCountInherited} IVs passed from the parents by default (max IV ${ivInheritance.maxIv}).`,
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
  const drafts: StepDraft[] = []

  const incense = buildIncenseStep(species)
  if (incense) drafts.push(incense)

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
    ),
  )

  const ivStep = buildIvStep(game, ruleset, target)
  if (ivStep) {
    const conflict = heldItemConflictFlag(strategy.parents, ruleset, target)
    drafts.push(
      conflict
        ? {
            ...ivStep,
            ruleFlags: [...(ivStep.ruleFlags ?? []), conflict],
          }
        : ivStep,
    )
  }

  return finalizeSteps(drafts)
}

const SHINY_DETERMINED_ON_RECEIVE =
  "Shininess is decided the moment you receive the egg — hatch-speed modifiers don't change the odds, and resetting after that point can't change the result."

function buildShinyPayload(game: GameData, ruleset: Ruleset): ShinyOdds {
  const modifiers = game.shinyEggModifiers
  const tiers: ShinyOddsTier[] = [
    {
      id: 'base',
      label: 'Base egg odds',
      odds: ruleset.baseShinyOdds.odds,
      approximateEggs: ruleset.baseShinyOdds.approximateEggs,
    },
  ]

  if (modifiers?.shinyCharmAvailable && modifiers.shinyCharmOdds) {
    const unlock = modifiers.shinyCharmUnlock
    const note = modifiers.shinyCharmAloneNote
    const context = [
      unlock
        ? `Applies if you already have the Shiny Charm — it means ${unlock}. Not a step in this hatch plan.`
        : 'Applies if you already have the Shiny Charm. Not a step in this hatch plan.',
      note,
    ]
      .filter(Boolean)
      .join(' ')
    tiers.push({
      id: 'shinyCharm',
      label: 'Shiny Charm',
      odds: modifiers.shinyCharmOdds.odds,
      approximateEggs: modifiers.shinyCharmOdds.approximateEggs,
      context,
    })
  }

  if (ruleset.masudaMethod) {
    tiers.push({
      id: 'masuda',
      label: 'Masuda Method',
      odds: ruleset.masudaMethod.odds,
      approximateEggs: ruleset.masudaMethod.approximateEggs,
      context:
        'A parent originating from a different-language game than its partner.',
    })
  }

  if (
    ruleset.masudaMethod &&
    modifiers?.shinyCharmAvailable &&
    modifiers.shinyCharmStacksWithMasuda &&
    modifiers.masudaPlusCharmOdds
  ) {
    tiers.push({
      id: 'masudaPlusCharm',
      label: 'Masuda Method + Shiny Charm',
      odds: modifiers.masudaPlusCharmOdds.odds,
      approximateEggs: modifiers.masudaPlusCharmOdds.approximateEggs,
    })
  }

  const noBoostsReason =
    !ruleset.masudaMethod && !modifiers?.shinyCharmAvailable
      ? (game.noEggShinyBoostsReason ??
        'Nothing in this game improves egg shiny odds.')
      : undefined

  return {
    tiers,
    noBoostsReason,
    determinedOnReceive: SHINY_DETERMINED_ON_RECEIVE,
  }
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
    throw new Error(
      `Engine invariant violation: no pairing strategies for ${target.species} in ${game.id}. This is not a user-facing state.`,
    )
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
    shiny: buildShinyPayload(game, ruleset),
  }
}
