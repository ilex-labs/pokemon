/**
 * Route-level acquisition cost. Engine derives the structure from resolved
 * parents; formatAcquisitionCost writes the chooser sentence — same split
 * as formatReason.
 */

import type { GameData, SpeciesEggData } from '../data/schema'

export type EggMoveRole =
  | 'none'
  | 'carrier'
  | 'same-species'
  | 'consolidated'
  | 'already-knows'

export type ParentAcquisitionFact = {
  species: string[]
  genderConstrained: boolean
  gender?: 'male' | 'female'
  genderKind?: 'forced' | 'allocation'
  genderReasonCodes: string[]
  /** Only names present in game.species. */
  cataloguedGenderRatio: Array<{
    species: string
    ratio: SpeciesEggData['genderRatio']
  }>
  mustKnowMoves: boolean
  moves: string[]
  mustOriginateFromDifferentLanguage: boolean
  isDitto: boolean
  hasTargetNature: boolean
  eggMoveRole: EggMoveRole
}

export type AcquisitionCost = {
  parents: ParentAcquisitionFact[]
  /** From game.eggMoveAlternative — for incomparable copy, not Q. */
  eggMoveAlternativeName?: string
}

type ParentSnapshot = {
  species: string[]
  gender?: 'male' | 'female'
  genderKind?: 'forced' | 'allocation'
  genderReason?: Array<{ code: string }>
  mustKnow?: string[]
  mustHaveNature?: string
  mustOriginateFromDifferentLanguage?: boolean
  acquisition?: Array<{ code: string }>
}

function speciesKey(parent: ParentSnapshot): string {
  return parent.species.join('\0')
}

function eggMoveRoleFor(
  parent: ParentSnapshot,
  all: ParentSnapshot[],
): EggMoveRole {
  const moves = parent.mustKnow ?? []
  if (moves.length === 0) return 'none'
  const codes = new Set((parent.acquisition ?? []).map((flag) => flag.code))
  if (codes.has('acquire-egg-move-ditto-alternative')) return 'consolidated'
  if (
    codes.has('acquire-egg-move-ditto-father-only') ||
    codes.has('acquire-egg-move-ditto-bootstrap')
  ) {
    return 'already-knows'
  }
  const differs = all.some(
    (other) => other !== parent && speciesKey(other) !== speciesKey(parent),
  )
  if (codes.has('acquire-egg-move-pair') && differs) return 'carrier'
  if (codes.has('acquire-egg-move-pair')) return 'same-species'
  return 'none'
}

export function deriveAcquisitionCost(
  parents: ParentSnapshot[],
  game: GameData,
): AcquisitionCost {
  return {
    eggMoveAlternativeName: game.eggMoveAlternative?.name,
    parents: parents.map((parent) => {
      const moves = parent.mustKnow ? [...parent.mustKnow] : []
      const cataloguedGenderRatio: ParentAcquisitionFact['cataloguedGenderRatio'] =
        []
      for (const name of parent.species) {
        const spec = game.species[name]
        if (spec) {
          cataloguedGenderRatio.push({
            species: name,
            ratio: spec.genderRatio,
          })
        }
      }
      return {
        species: [...parent.species],
        genderConstrained: parent.gender != null,
        gender: parent.gender,
        genderKind: parent.genderKind,
        genderReasonCodes: (parent.genderReason ?? []).map(
          (reason) => reason.code,
        ),
        cataloguedGenderRatio,
        mustKnowMoves: moves.length > 0,
        moves,
        mustOriginateFromDifferentLanguage: Boolean(
          parent.mustOriginateFromDifferentLanguage,
        ),
        isDitto: parent.species.length === 1 && parent.species[0] === 'Ditto',
        hasTargetNature: Boolean(parent.mustHaveNature),
        eggMoveRole: eggMoveRoleFor(parent, parents),
      }
    }),
  }
}

function joinMoves(moves: string[]): string {
  return moves.join('/')
}

function genderIsAllocation(parent: ParentAcquisitionFact): boolean {
  return parent.genderKind === 'allocation'
}

/**
 * Gender to put in the chooser sentence. Forced genders are always named.
 * Allocation names only a scarce side — strictly below half of catalogued
 * encounters. Uncatalogued allocation stays unnamed (external carriers keep
 * the existing "male carrier" wording).
 */
function namedGender(
  parent: ParentAcquisitionFact,
): 'male' | 'female' | null {
  if (!parent.genderConstrained || parent.gender == null) return null
  if (!genderIsAllocation(parent)) return parent.gender
  if (parent.cataloguedGenderRatio.length === 0) return null
  const fractions = parent.cataloguedGenderRatio.map((entry) =>
    genderEncounterFraction(parent.gender!, entry.ratio),
  )
  const easiest = Math.max(...fractions)
  if (easiest >= 0.5) return null
  return parent.gender
}

function namedSpecies(parent: ParentAcquisitionFact): string {
  const name = parent.species[0] ?? 'parent'
  const gender = namedGender(parent)
  return gender ? `${gender} ${name}` : name
}

function parentAttributeTail(
  parent: ParentAcquisitionFact,
  knows?: 'that knows',
): string {
  let tail = ''
  if (parent.hasTargetNature) tail += ' with the target nature'
  if (knows === 'that knows' && parent.moves.length > 0) {
    tail += ` that knows ${joinMoves(parent.moves)}`
  }
  if (parent.mustOriginateFromDifferentLanguage) {
    tail += ' whose origin language differs from its partner'
  }
  return tail
}

/** One "one …" clause per parent: gender, nature, moves, Masuda together. */
function sameSpeciesParentPhrase(
  parent: ParentAcquisitionFact,
): string | null {
  if (parent.isDitto) return null
  const gender = namedGender(parent)
  const knows =
    parent.eggMoveRole === 'same-species' && parent.moves.length > 0
      ? 'that knows'
      : undefined
  const tail = parentAttributeTail(parent, knows)
  if (!gender && tail === '') return null
  return gender ? `one ${gender}${tail}` : `one${tail}`
}

/**
 * Chooser sentence. Masuda is read from mustOriginateFromDifferentLanguage
 * on a parent — never from a half-built string.
 */
export function formatAcquisitionCost(cost: AcquisitionCost): string {
  const facts = cost.parents
  const ditto = facts.find((parent) => parent.isDitto)
  const hasNature = facts.some((parent) => parent.hasTargetNature)

  if (ditto) {
    const line = facts.find((parent) => !parent.isDitto)
    const name = line ? namedSpecies(line) : 'parent'
    const dittoClause = ditto.mustOriginateFromDifferentLanguage
      ? 'plus a Ditto whose origin language differs from its partner'
      : 'plus a Ditto'
    const moves = line?.moves ?? []

    if (line?.eggMoveRole === 'consolidated' && moves.length > 0) {
      const moveList = joinMoves(moves)
      return hasNature
        ? `one ${name} with the target nature and ${moveList} consolidated, ${dittoClause}`
        : `one ${name} with ${moveList} consolidated, ${dittoClause}`
    }
    if (line?.eggMoveRole === 'already-knows' && moves.length > 0) {
      const moveList = joinMoves(moves)
      return hasNature
        ? `one ${name} with the target nature that already knows ${moveList}, ${dittoClause}`
        : `one ${name} that already knows ${moveList}, ${dittoClause}`
    }
    return hasNature
      ? `one ${name} with the target nature, ${dittoClause}`
      : `one ${name}, ${dittoClause}`
  }

  const carrier = facts.find((parent) => parent.eggMoveRole === 'carrier')
  if (carrier && carrier.moves.length > 0) {
    const line = facts.find((parent) => parent !== carrier)
    const name = line ? namedSpecies(line) : 'parent'
    const moveList = joinMoves(carrier.moves)
    const lineTail = line
      ? parentAttributeTail({
          ...line,
          mustOriginateFromDifferentLanguage: false,
        })
      : ''
    const body = `one ${name}${lineTail}, plus a male ${moveList} carrier`
    const foreign = facts.find(
      (parent) => parent.mustOriginateFromDifferentLanguage,
    )
    if (foreign) {
      const foreignName = foreign.species[0] ?? 'parent'
      return `${body}; the ${foreignName} whose origin language differs from its partner`
    }
    return body
  }

  const name = facts[0]?.species[0] ?? 'parent'
  const phrases = facts
    .map((parent) => sameSpeciesParentPhrase(parent))
    .filter((phrase): phrase is string => phrase != null)
  return phrases.length > 0
    ? `two ${name}, ${phrases.join('; ')}`
    : `two ${name}`
}

function genderEncounterFraction(
  gender: 'male' | 'female',
  ratio: SpeciesEggData['genderRatio'],
): number {
  if (ratio === 'genderless') return 0
  if (ratio === 'male-only') return gender === 'male' ? 1 : 0
  if (ratio === 'female-only') return gender === 'female' ? 1 : 0
  const male = ratio.malePercent / 100
  return gender === 'male' ? male : 1 - male
}

/** Product of encounter fractions. Higher is easier. Empty product is 1. Never rendered. */
export function genderProduct(cost: AcquisitionCost): number {
  let product = 1
  for (const parent of cost.parents) {
    if (!parent.genderConstrained || parent.gender == null) continue
    if (parent.cataloguedGenderRatio.length === 0) continue
    const fractions = parent.cataloguedGenderRatio.map((entry) =>
      genderEncounterFraction(parent.gender!, entry.ratio),
    )
    product *= Math.max(...fractions)
  }
  return product
}

function qualitativeKeys(cost: AcquisitionCost): string[] {
  const keys = new Set<string>()
  for (const parent of cost.parents) {
    if (parent.hasTargetNature) keys.add('nature')
    if (parent.mustOriginateFromDifferentLanguage) keys.add('masuda')
    if (parent.eggMoveRole === 'none' || parent.moves.length === 0) continue
    for (const move of parent.moves) {
      keys.add(`moves:${parent.eggMoveRole}:${move}`)
    }
  }
  return [...keys].sort()
}

export type IncomparableWorkKind =
  | 'nature'
  | 'masuda'
  | 'carrier'
  | 'same-species'
  | 'consolidated'
  | 'already-knows'

const MOVE_ROLE_IN_KEY =
  /^moves:(carrier|same-species|consolidated|already-knows):/

/** Q keys exclusive to one side, collapsed to work kinds for the sentence. */
export function workKindsFromQualitativeKeys(
  keys: string[],
): IncomparableWorkKind[] {
  const kinds: IncomparableWorkKind[] = []
  const seen = new Set<string>()
  for (const key of keys) {
    if (key === 'nature' || key === 'masuda') {
      if (!seen.has(key)) {
        seen.add(key)
        kinds.push(key)
      }
      continue
    }
    const match = MOVE_ROLE_IN_KEY.exec(key)
    if (match) {
      const role = match[1] as IncomparableWorkKind
      if (!seen.has(role)) {
        seen.add(role)
        kinds.push(role)
      }
    }
  }
  return kinds
}

function isSubset(left: string[], right: string[]): boolean {
  return left.every((key) => right.includes(key))
}

export type RouteComparisonOutcome =
  | { outcome: 'equivalent' }
  | { outcome: 'cheaper'; winner: 'a' | 'b' }
  | {
      outcome: 'incomparable'
      gDiffers: boolean
      onlyA: string[]
      onlyB: string[]
    }

/**
 * Pareto: easier gender product and qualitative extras a subset.
 * Partner identity is not in Q. Egg-move roles are distinct facts
 * (carrier, same-species, consolidated, already-knows), not a subset
 * relation.
 */
export function compareRouteCosts(
  a: AcquisitionCost,
  b: AcquisitionCost,
): RouteComparisonOutcome {
  const genderA = genderProduct(a)
  const genderB = genderProduct(b)
  const qualA = qualitativeKeys(a)
  const qualB = qualitativeKeys(b)
  const sameQual = qualA.join('\0') === qualB.join('\0')
  const aQualSubset = isSubset(qualA, qualB)
  const bQualSubset = isSubset(qualB, qualA)
  const aQualStrict = aQualSubset && !sameQual
  const bQualStrict = bQualSubset && !sameQual

  const aDominates =
    genderA >= genderB && aQualSubset && (genderA > genderB || aQualStrict)
  const bDominates =
    genderB >= genderA && bQualSubset && (genderB > genderA || bQualStrict)

  if (aDominates && !bDominates) return { outcome: 'cheaper', winner: 'a' }
  if (bDominates && !aDominates) return { outcome: 'cheaper', winner: 'b' }
  if (genderA === genderB && sameQual) return { outcome: 'equivalent' }
  return {
    outcome: 'incomparable',
    gDiffers: genderA !== genderB,
    onlyA: qualA.filter((key) => !qualB.includes(key)),
    onlyB: qualB.filter((key) => !qualA.includes(key)),
  }
}
