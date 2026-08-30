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
import {
  compareRouteCosts,
  deriveAcquisitionCost,
  formatAcquisitionCost,
  workKindsFromQualitativeKeys,
  type AcquisitionCost,
} from '../lib/acquisitionCost.ts'
import {
  unknownPlayer,
  type PlayerState,
} from './playerState.ts'

export type { PlayerFact, PlayerState } from './playerState.ts'
export { unknownPlayer } from './playerState.ts'

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
  heldItemReason?: Reason[]
  /** Masuda — origin language must differ from the other parent. */
  mustOriginateFromDifferentLanguage?: boolean
  acquisition?: AcquisitionFlag[]
}

export type AcquisitionFlag = RuleFlag

export type PairingStrategy = {
  id: string
  label: string
  parents: ParentRequirement[]
  /** Chooser line — what you have to go acquire for this route. */
  acquisitionCost: string
  /** Longer trade-off note for detail / dumps; not the chooser. */
  tradeoff: string
  recommended?: boolean
  /** Required whenever recommended — e.g. easier gender hunt. */
  recommendReason?: Reason
  /**
   * This pairing needs a parent produced by another route in this plan.
   * Present only on the later strategy, and only when that supplier is offered.
   * One id when cost picks a supplier; several when they tie or are
   * incomparable — the reason names them rather than inventing a winner.
   */
  requiresRoute?: {
    ids: string[]
    reason: Reason
  }
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

export type RoutePairComparison = {
  a: string
  b: string
  outcome: 'cheaper' | 'equivalent' | 'incomparable'
  /** Strategy id of the cheaper route. Present only when outcome is cheaper. */
  winner?: string
  /** Present when outcome is incomparable. */
  gDiffers?: boolean
  qOnlyA?: string[]
  qOnlyB?: string[]
  alternativeName?: string
}

export type DaycarePlan = {
  strategies: PairingStrategy[]
  /**
   * Pairwise cost comparison. Omitted for a single route. Always includes
   * every pair when two or more routes exist — including follow-on pairs.
   */
  routeComparisons?: RoutePairComparison[]
  /**
   * Routes that would otherwise appear but cannot produce this target —
   * always explained, never silently dropped.
   */
  excludedStrategies?: Array<{
    id: string
    label: string
    reason: Reason
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
  /** Item effect, plus an independent holder restriction when one applies. */
  reasons: Reason[]
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
): Reason | null {
  if (!wantsAbility(target, ruleset, species)) return null
  if (!ruleset.abilityInheritance.inheritanceExists) return null
  if (!ruleset.abilityInheritance.maleOrGenderlessNeedsDitto) return null
  if (!isMaleOrGenderlessRatio(species.genderRatio)) return null

  const ability = target.ability
  if (isAbilityHidden(species, ability)) {
    return { code: 'exclude-pair-hidden-needs-ditto', ability }
  }
  return { code: 'exclude-pair-ability-needs-ditto', ability }
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
): AcquisitionFlag | undefined {
  if (eggGroupsForSpecies(game, name).length > 0) return undefined
  if (isKnownSpecies(game, name)) {
    return {
      severity: 'warning',
      code: 'egg-group-catalogued-empty',
      species: name,
    }
  }
  return {
    severity: 'warning',
    code: 'egg-group-unknown',
    species: name,
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

function pushAcquisition(parent: ParentRequirement, flag: AcquisitionFlag) {
  parent.acquisition = [...(parent.acquisition ?? []), flag]
}

function masudaAcquisitionFlag(game: GameData): AcquisitionFlag {
  const how =
    game.masudaAcquisition?.how ??
    'You may already have one — a pair from different-language games would count. Otherwise trade for one, or import from a cartridge saved in another language.'
  return {
    severity: 'info',
    code: 'acquire-masuda',
    how,
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

function routeAcquisitionCost(
  parents: ParentRequirement[],
  game: GameData,
): string {
  return formatAcquisitionCost(deriveAcquisitionCost(parents, game))
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

function natureAcquisitionFlags(game: GameData, nature: string): AcquisitionFlag[] {
  const flags: AcquisitionFlag[] = []
  if (game.natureAcquisition?.how) {
    flags.push({
      severity: 'info',
      code: 'acquire-nature',
      nature,
      how: game.natureAcquisition.how,
    })
  }
  if (game.mintsAvailable) {
    flags.push({
      severity: 'warning',
      code: 'mints-dont-pass',
    })
  }
  return flags
}

function abilityAcquisitionFlag(
  game: GameData,
  ruleset: Ruleset,
  species: SpeciesEggData,
  ability: string,
): AcquisitionFlag | undefined {
  if (!ruleset.abilitiesExist) return undefined

  if (isAbilityHidden(species, ability)) {
    const how =
      game.abilityAcquisition?.hidden ??
      'Obtain a parent that already has this hidden ability, or use an Ability Patch where available.'
    const canPass = ruleset.abilityInheritance.hiddenAbilityViaEggs
    return canPass
      ? {
          severity: 'info',
          code: 'acquire-hidden-can-pass',
          ability,
          how,
        }
      : {
          severity: 'blocking',
          code: 'acquire-hidden-cannot-pass',
          ability,
          how,
        }
  }

  if (game.abilityAcquisition?.standard) {
    return {
      severity: 'info',
      code: 'acquire-standard-ability',
      ability,
      how: game.abilityAcquisition.standard,
    }
  }
  return undefined
}

function pairOppositeGenders(): Reason {
  return { code: 'pair-opposite-genders' }
}

function isDittoParent(parent: ParentRequirement): boolean {
  return parent.species.length === 1 && parent.species[0] === 'Ditto'
}

/** Same-species pair always needs one of each gender. Fill only what is missing. */
function fillSameSpeciesPairGenders(parents: ParentRequirement[]) {
  if (parents.length !== 2) return
  const parentA = parents.find((parent) => parent.role === 'A')
  const parentB = parents.find((parent) => parent.role === 'B')
  if (!parentA || !parentB) return
  if (isDittoParent(parentA) || isDittoParent(parentB)) return
  if (parentA.species.length !== 1 || parentB.species.length !== 1) return
  if (parentA.species[0] !== parentB.species[0]) return

  if (!parentA.gender) {
    parentA.gender = 'female'
    parentA.genderReason = [pairOppositeGenders()]
  }
  if (!parentB.gender) {
    parentB.gender = 'male'
    parentB.genderReason = [pairOppositeGenders()]
  }
}

function femaleSpeciesHolder(offspringSpecies: string): Reason {
  return { code: 'female-species-holder', offspringSpecies }
}

function femaleAbilityNeedsDitto(): Reason {
  return { code: 'female-ability-needs-ditto' }
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
    const reasons: Reason[] = [
      lock.method === 'everstone-guaranteed'
        ? { code: 'everstone-guaranteed', nature: target.nature }
        : { code: 'everstone-chance', nature: target.nature },
    ]
    if (lock.holder === 'female-or-ditto') {
      reasons.push({ code: 'holder-female-or-ditto' })
    }
    demands.push({
      id: 'everstone',
      label: 'Everstone',
      placement:
        lock.holder === 'female-or-ditto' ? 'female-or-ditto' : 'either',
      reasons,
    })
  }

  if (hasSpecificIvTargets(ivs) && ruleset.ivInheritance.destinyKnotAvailable) {
    const { baseCountInherited, destinyKnotBoostedCount } = ruleset.ivInheritance
    demands.push({
      id: 'destiny-knot',
      label: 'Destiny Knot',
      placement: 'either',
      reasons: [
        {
          code: 'destiny-knot-iv',
          baseCountInherited,
          destinyKnotBoostedCount,
        },
      ],
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
      reasons: [{ code: 'power-item-iv' }],
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
    parent.heldItemReason = [...demand.reasons]
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
              natureParent.genderReason = [{ code: 'holder-female-or-ditto' }]
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
    .filter((label): label is string => Boolean(label))
  const assigned = parents
    .map((parent) => parent.heldItem)
    .filter((item): item is string => Boolean(item))

  return {
    severity: 'warning',
    code: 'held-item-conflict',
    assigned,
    unassigned,
    knotVersusPower:
      remaining.has('destiny-knot') || remaining.has('power-item'),
  }
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
  useExternalCarrier: boolean,
  route: { id: string; label: string },
): PairingStrategy {
  const natureWanted = wantsNature(target, ruleset)
  const abilityWanted = wantsAbility(target, ruleset, species)
  const abilityNeedsFemale =
    abilityWanted && ruleset.abilityInheritance.maleOrGenderlessNeedsDitto
  const passers = eggMovePasserSpecies(game, target.species, target.eggMoves)
  const externalPassers = passers.filter((name) => name !== target.species)

  const parentA: ParentRequirement = {
    role: 'A',
    species: [target.species],
  }
  applyNatureAbility(parentA, game, ruleset, species, target)

  // Recompute gender from what the target actually forces — do not assert.
  if (natureWanted || useExternalCarrier) {
    parentA.gender = 'female'
    if (useExternalCarrier) {
      parentA.genderReason = [femaleSpeciesHolder(target.species)]
    } else {
      parentA.genderReason = [pairOppositeGenders()]
    }
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
    const how =
      game.eggMoveAcquisition?.how ??
      "Catch or hatch a parent that already knows the move, or copy it with this game's egg-move alternative."
    pushAcquisition(parentB, {
      severity: 'info',
      code: 'acquire-egg-move-pair',
      species: target.species,
      moves: [...target.eggMoves],
      how,
      passers: useExternalCarrier ? externalPassers : [],
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
    parentB.genderReason = [pairOppositeGenders()]
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), false)
  applyMasudaConstraint(parents, game, target, ruleset)
  fillSameSpeciesPairGenders(parents)

  const tradeoff = useExternalCarrier
    ? 'No consolidation prerequisite, but the egg-move carrier must be male or eggs hatch as that species.'
    : 'Pairs two of the target line — held items and hatching match the Ditto route.'

  return {
    id: route.id,
    label: route.label,
    parents,
    acquisitionCost: routeAcquisitionCost(parents, game),
    tradeoff,
  }
}

const SPECIES_PAIR_ROUTE = { id: 'species-pair', label: 'Species pair' }

function buildSpeciesPairStrategies(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
): PairingStrategy[] {
  const passers = eggMovePasserSpecies(game, target.species, target.eggMoves)
  const targetIsPasser = passers.includes(target.species)
  const externalPassers = passers.filter((name) => name !== target.species)
  const wantsMoves = target.eggMoves.length > 0
  const hasExternal = wantsMoves && externalPassers.length > 0
  const hasSame = wantsMoves && targetIsPasser

  if (hasSame && hasExternal) {
    return [
      buildSpeciesPairStrategy(game, ruleset, target, species, false, {
        id: 'species-pair-same',
        label: 'Same-species pair',
      }),
      buildSpeciesPairStrategy(game, ruleset, target, species, true, {
        id: 'species-pair-external',
        label: 'External carrier',
      }),
    ]
  }
  if (hasExternal) {
    return [
      buildSpeciesPairStrategy(
        game,
        ruleset,
        target,
        species,
        true,
        SPECIES_PAIR_ROUTE,
      ),
    ]
  }
  return [
    buildSpeciesPairStrategy(
      game,
      ruleset,
      target,
      species,
      false,
      SPECIES_PAIR_ROUTE,
    ),
  ]
}

function buildDittoPairStrategy(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
): PairingStrategy {
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
    if (alt != null) {
      pushAcquisition(parentA, {
        severity: 'info',
        code: 'acquire-egg-move-ditto-alternative',
        species: target.species,
        moves: [...target.eggMoves],
        alternativeName: alt.name,
        alternativeHow: alt.howItWorks,
        passers,
      })
    } else if (fatherOnlyMoves) {
      pushAcquisition(parentA, {
        severity: 'info',
        code: 'acquire-egg-move-ditto-father-only',
        species: target.species,
        moves: [...target.eggMoves],
      })
    } else {
      pushAcquisition(parentA, {
        severity: 'info',
        code: 'acquire-egg-move-ditto-bootstrap',
        species: target.species,
        moves: [...target.eggMoves],
      })
    }
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
      code: 'acquire-ditto',
      obtainedAt: game.ditto.obtainedAt,
    })
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), true)
  applyMasudaConstraint(parents, game, target, ruleset)

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
    acquisitionCost: routeAcquisitionCost(parents, game),
    tradeoff: `${moveNote} Ditto cannot carry egg moves itself.`,
  }
}

function buildDittoOnlyStrategy(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  species: SpeciesEggData,
): PairingStrategy {
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
      code: 'acquire-ditto',
      obtainedAt: game.ditto.obtainedAt,
    })
  }

  const parents = [parentA, parentB]
  allocateHeldItems(parents, collectHeldItemDemands(ruleset, target), true)
  applyMasudaConstraint(parents, game, target, ruleset)

  return {
    id: 'ditto-only',
    label: 'Ditto pair',
    parents,
    acquisitionCost: routeAcquisitionCost(parents, game),
    tradeoff: `${target.species} can only pair with Ditto in this game.`,
  }
}

function isDittoRoute(strategy: PairingStrategy): boolean {
  return strategy.id === 'ditto-pair' || strategy.id === 'ditto-only'
}

function alreadyKnowsMoves(cost: AcquisitionCost): string[] | undefined {
  const parent = cost.parents.find(
    (entry) => entry.eggMoveRole === 'already-knows',
  )
  return parent ? parent.moves : undefined
}

/** Species-pair hatch that can supply an already-knows parent — not the Ditto route. */
function isHatchSupplier(cost: AcquisitionCost): boolean {
  if (alreadyKnowsMoves(cost) !== undefined) return false
  return cost.parents.some((parent) => {
    if (!parent.mustKnowMoves) return false
    const partner = cost.parents.find((other) => other !== parent)
    if (!partner || partner.isDitto) return false
    return (
      parent.eggMoveRole === 'carrier' || parent.eggMoveRole === 'same-species'
    )
  })
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`
}

function sequencedPairKeys(
  strategies: Array<{ id: string; requiresRoute?: { ids: string[] } }>,
): Set<string> {
  const keys = new Set<string>()
  for (const strategy of strategies) {
    for (const id of strategy.requiresRoute?.ids ?? []) {
      keys.add(pairKey(strategy.id, id))
    }
  }
  return keys
}

export type ChooserComparisonCopy =
  | { kind: 'equivalent' }
  | { kind: 'incomparable'; reason: Reason }
  | null

/**
 * Cost copy for the chooser. Sequenced (supplier-consumer) pairs are excluded
 * — the follow-on sentence is that pair's copy. Two routes omit pair labels;
 * three or more name the pair. The clause is the pair's Q/G axis.
 */
export function chooserComparisonCopy(
  comparisons: RoutePairComparison[] | undefined,
  strategies: Array<{
    id: string
    label: string
    requiresRoute?: { ids: string[] }
  }>,
): ChooserComparisonCopy {
  if (!comparisons || comparisons.length === 0 || strategies.length < 2) {
    return null
  }
  const sequenced = sequencedPairKeys(strategies)
  const competing = comparisons.filter(
    (pair) => !sequenced.has(pairKey(pair.a, pair.b)),
  )
  if (competing.length === 0) return null
  if (competing.every((pair) => pair.outcome === 'equivalent')) {
    return { kind: 'equivalent' }
  }
  const incomparable = competing.filter(
    (pair) => pair.outcome === 'incomparable',
  )
  if (incomparable.length === 0) return null
  const pair = incomparable[0]!
  const left = workKindsFromQualitativeKeys(pair.qOnlyA ?? [])
  const right = workKindsFromQualitativeKeys(pair.qOnlyB ?? [])
  const labels = (id: string) =>
    strategies.find((strategy) => strategy.id === id)?.label ?? id
  const named = strategies.length >= 3
  return {
    kind: 'incomparable',
    reason: {
      code: 'incomparable-routes',
      ...(named
        ? { aLabel: labels(pair.a), bLabel: labels(pair.b) }
        : {}),
      gVersusExtra: (left.length === 0) !== (right.length === 0),
      left,
      right,
      ...(pair.alternativeName
        ? { alternativeName: pair.alternativeName }
        : {}),
    },
  }
}

function computeRouteComparisons(
  strategies: PairingStrategy[],
  costs: AcquisitionCost[],
): RoutePairComparison[] {
  const comparisons: RoutePairComparison[] = []
  for (let i = 0; i < strategies.length; i++) {
    for (let j = i + 1; j < strategies.length; j++) {
      const result = compareRouteCosts(costs[i]!, costs[j]!)
      const a = strategies[i]!.id
      const b = strategies[j]!.id
      if (result.outcome === 'cheaper') {
        comparisons.push({
          a,
          b,
          outcome: 'cheaper',
          winner: result.winner === 'a' ? a : b,
        })
      } else if (result.outcome === 'equivalent') {
        comparisons.push({ a, b, outcome: 'equivalent' })
      } else {
        const alternativeName =
          costs[i]!.eggMoveAlternativeName ??
          costs[j]!.eggMoveAlternativeName
        comparisons.push({
          a,
          b,
          outcome: 'incomparable',
          gDiffers: result.gDiffers,
          qOnlyA: result.onlyA,
          qOnlyB: result.onlyB,
          ...(alternativeName ? { alternativeName } : {}),
        })
      }
    }
  }
  return comparisons
}

/**
 * Pairwise cost comparison always. Follow-on is a separate relation: those
 * pairs do not compete for Recommended or cost copy, but they stay in the
 * matrix. Masuda is an overlay on the badge only — the pair still gets
 * cost copy.
 */
export function applyRouteRecommendations(
  strategies: PairingStrategy[],
  game: GameData,
  preferForeignDitto = false,
): {
  strategies: PairingStrategy[]
  routeComparisons?: RoutePairComparison[]
} {
  if (strategies.length === 0) {
    return { strategies }
  }

  if (strategies.length === 1) {
    const only = strategies[0]!
    if (preferForeignDitto && isDittoRoute(only)) {
      return {
        strategies: [
          {
            ...only,
            recommended: true,
            recommendReason: { code: 'recommend-masuda-ditto-reuse' },
          },
        ],
      }
    }
    return {
      strategies: [
        {
          ...only,
          recommended: true,
          recommendReason: { code: 'recommend-only-viable-route' },
        },
      ],
    }
  }

  const costs = strategies.map((strategy) =>
    deriveAcquisitionCost(strategy.parents, game),
  )
  const routeComparisons = computeRouteComparisons(strategies, costs)

  const laterIndex = costs.findIndex(
    (cost) => alreadyKnowsMoves(cost) !== undefined,
  )
  const supplierIndexes =
    laterIndex >= 0
      ? costs
          .map((_, index) => index)
          .filter(
            (index) =>
              index !== laterIndex && isHatchSupplier(costs[index]!),
          )
      : []

  let annotated: PairingStrategy[] = strategies.map((strategy) => ({
    ...strategy,
    recommended: undefined,
    recommendReason: undefined,
    requiresRoute: undefined,
  }))

  if (laterIndex >= 0 && supplierIndexes.length > 0) {
    const cheaperIndexes = supplierIndexes.filter((index) =>
      supplierIndexes.every((other) => {
        if (other === index) return true
        const result = compareRouteCosts(costs[index]!, costs[other]!)
        return result.outcome === 'cheaper' && result.winner === 'a'
      }),
    )
    const chosenIndexes =
      cheaperIndexes.length === 1 ? cheaperIndexes : supplierIndexes
    const recommendIndex = cheaperIndexes.length === 1 ? cheaperIndexes[0]! : -1
    const fromLabels = chosenIndexes.map((index) => strategies[index]!.label)
    const chosenIds = chosenIndexes.map((index) => strategies[index]!.id)
    const moves = alreadyKnowsMoves(costs[laterIndex]!) ?? []
    annotated = strategies.map((strategy, index) => {
      if (index === recommendIndex) {
        return {
          ...strategy,
          recommended: true,
          recommendReason: {
            code: 'recommend-start-from-hatch',
            laterLabel: strategies[laterIndex]!.label,
          },
          requiresRoute: undefined,
        }
      }
      if (index === laterIndex) {
        return {
          ...strategy,
          recommended: undefined,
          recommendReason: undefined,
          requiresRoute: {
            ids: chosenIds,
            reason: {
              code: 'requires-hatch-from-route',
              fromLabels,
              moves,
            },
          },
        }
      }
      return {
        ...strategy,
        recommended: undefined,
        recommendReason: undefined,
        requiresRoute: undefined,
      }
    })
  }

  if (preferForeignDitto) {
    const dittoRoute = annotated.find(isDittoRoute)
    if (dittoRoute) {
      annotated = annotated.map((strategy) =>
        strategy.id === dittoRoute.id
          ? {
              ...strategy,
              recommended: true,
              recommendReason: { code: 'recommend-masuda-ditto-reuse' },
            }
          : {
              ...strategy,
              recommended: undefined,
              recommendReason: undefined,
            },
      )
    }
  }

  const alreadyRecommended = annotated.some((strategy) => strategy.recommended)
  const consumerIds = new Set(
    annotated
      .filter((strategy) => strategy.requiresRoute)
      .map((strategy) => strategy.id),
  )
  const competingIds = annotated
    .map((strategy) => strategy.id)
    .filter((id) => !consumerIds.has(id))

  if (!alreadyRecommended && competingIds.length >= 2) {
    const beatsAll = competingIds.filter((id) =>
      competingIds.every((other) => {
        if (other === id) return true
        const pair = routeComparisons.find(
          (entry) => pairKey(entry.a, entry.b) === pairKey(id, other),
        )
        return pair?.outcome === 'cheaper' && pair.winner === id
      }),
    )
    if (beatsAll.length === 1) {
      const winnerId = beatsAll[0]!
      annotated = annotated.map((strategy) =>
        strategy.id === winnerId
          ? {
              ...strategy,
              recommended: true,
              recommendReason: { code: 'recommend-easier-gender' },
            }
          : {
              ...strategy,
              recommended: undefined,
              recommendReason: undefined,
            },
      )
    }
  }

  return { strategies: annotated, routeComparisons }
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
  routeComparisons?: RoutePairComparison[]
  excludedStrategies: Array<{ id: string; label: string; reason: Reason }>
} {
  const excludedStrategies: Array<{
    id: string
    label: string
    reason: Reason
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
        reason: {
          code: 'exclude-pair-ditto-only-species',
          species: target.species,
        },
      })
    }
    const recommended = applyRouteRecommendations(
      [buildDittoOnlyStrategy(game, ruleset, target, species)],
      game,
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
    strategies.push(
      ...buildSpeciesPairStrategies(game, ruleset, target, species),
    )
  }

  if (canOfferDittoPair(game, target)) {
    strategies.push(buildDittoPairStrategy(game, ruleset, target, species))
  }

  const recommended = applyRouteRecommendations(
    strategies,
    game,
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
        code: 'blocked-pair-no-ditto',
        species: speciesName,
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
        code: 'incense-omit-yields-adult',
        adult: species.hatchesInto,
        baby: species.babyWithIncense,
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
        code: 'acquire-hidden-cannot-pass',
        ability,
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
      code: 'hidden-ability-lower-rate',
      hiddenOdds,
      standardOdds,
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

  if (!access) {
    return {
      severity: 'info',
      code: 'hyper-no-access',
      level,
    }
  }

  return {
    severity: 'info',
    code: 'hyper-effort',
    tier: access.effort,
    level,
    goldBottleCap: access.goldBottleCap,
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
    code: 'held-item-conflict',
    assigned: held.filter((item): item is string => Boolean(item)),
    unassigned: missing,
    knotVersusPower: true,
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
      code: 'hyper-cannot-make-zero',
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

function markAcquireDittoSatisfied(
  strategies: PairingStrategy[],
): PairingStrategy[] {
  return strategies.map((strategy) => ({
    ...strategy,
    parents: strategy.parents.map((parent) => ({
      ...parent,
      acquisition: parent.acquisition?.map((flag) =>
        flag.code === 'acquire-ditto' ? { ...flag, satisfied: true } : flag,
      ),
    })),
  }))
}

function omitDittoGate(
  featureGates: FeatureGate[],
  game: GameData,
): FeatureGate[] {
  const gateId = game.ditto.gate
  if (!gateId) return featureGates
  return featureGates.filter((gate) => gate.id !== gateId)
}

function applyPlayerState(
  player: PlayerState,
  strategies: PairingStrategy[],
  featureGates: FeatureGate[],
  game: GameData,
): { strategies: PairingStrategy[]; featureGates: FeatureGate[] } {
  let nextStrategies = strategies
  let nextGates = featureGates
  for (const item of player) {
    switch (item.fact) {
      case 'owns-ditto':
        nextStrategies = markAcquireDittoSatisfied(nextStrategies)
        nextGates = omitDittoGate(nextGates, game)
        break
      default: {
        const _exhaustive: never = item
        return _exhaustive
      }
    }
  }
  return { strategies: nextStrategies, featureGates: nextGates }
}

export function planDaycare(
  game: GameData,
  ruleset: Ruleset,
  target: DaycareTarget,
  player: PlayerState = unknownPlayer,
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
              code: 'unknown-species',
              species: target.species,
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

  const resolved = resolveStrategies(
    game,
    ruleset,
    target,
    species,
    dittoOnly,
  )
  const { strategies, featureGates: gated } = applyPlayerState(
    player,
    resolved.strategies,
    featureGates,
    game,
  )
  const recommended =
    strategies.find((strategy) => strategy.recommended) ?? strategies[0]

  if (strategies.length === 0) {
    throw new Error(
      `Engine invariant violation: no pairing strategies for ${target.species} in ${game.id}. This is not a user-facing state.`,
    )
  }

  return {
    strategies,
    routeComparisons: resolved.routeComparisons,
    excludedStrategies:
      resolved.excludedStrategies.length > 0
        ? resolved.excludedStrategies
        : undefined,
    featureGates: gated,
    blocked: false,
    steps: recommended
      ? buildStepsForStrategy(game, ruleset, target, species, recommended)
      : [],
    shiny: buildShinyPayload(game, ruleset),
  }
}
