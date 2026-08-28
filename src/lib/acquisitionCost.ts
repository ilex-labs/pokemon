/**
 * Route-level acquisition cost. Engine derives the structure from resolved
 * parents; formatAcquisitionCost writes the chooser sentence — same split
 * as formatReason.
 */

import type { GameData, SpeciesEggData } from '../data/schema'

export type EggMoveRole = 'none' | 'carrier' | 'consolidated' | 'already-knows'

export type ParentAcquisitionFact = {
  species: string[]
  genderConstrained: boolean
  gender?: 'male' | 'female'
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
}

type ParentSnapshot = {
  species: string[]
  gender?: 'male' | 'female'
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
  return 'none'
}

export function deriveAcquisitionCost(
  parents: ParentSnapshot[],
  game: GameData,
): AcquisitionCost {
  return {
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

/**
 * Chooser sentence. Masuda is read from mustOriginateFromDifferentLanguage
 * on a parent — never from a half-built string.
 */
export function formatAcquisitionCost(cost: AcquisitionCost): string {
  const facts = cost.parents
  const ditto = facts.find((parent) => parent.isDitto)
  const hasNature = facts.some((parent) => parent.hasTargetNature)
  const foreign = facts.find(
    (parent) => parent.mustOriginateFromDifferentLanguage,
  )

  if (ditto) {
    const line = facts.find((parent) => !parent.isDitto)
    const name = line?.species[0] ?? 'parent'
    const dittoClause = ditto.mustOriginateFromDifferentLanguage
      ? 'plus a Ditto whose origin language differs from its partner'
      : 'plus a Ditto'
    const moves = line?.moves ?? []
    const malePrefix =
      line?.genderConstrained && line.gender === 'male' ? 'male ' : ''

    if (line?.eggMoveRole === 'consolidated' && moves.length > 0) {
      const moveList = joinMoves(moves)
      return hasNature
        ? `one ${name} with the target nature and ${moveList} consolidated, ${dittoClause}`
        : `one ${name} with ${moveList} consolidated, ${dittoClause}`
    }
    if (line?.eggMoveRole === 'already-knows' && moves.length > 0) {
      const moveList = joinMoves(moves)
      return hasNature
        ? `one ${malePrefix}${name} with the target nature that already knows ${moveList}, ${dittoClause}`
        : `one ${malePrefix}${name} that already knows ${moveList}, ${dittoClause}`
    }
    return hasNature
      ? `one ${name} with the target nature, ${dittoClause}`
      : `one ${name}, ${dittoClause}`
  }

  const carrier = facts.find((parent) => parent.eggMoveRole === 'carrier')
  if (carrier && carrier.moves.length > 0) {
    const line = facts.find((parent) => parent !== carrier)
    const name = line?.species[0] ?? 'parent'
    const moveList = joinMoves(carrier.moves)
    const body = hasNature
      ? `one ${name} with the target nature, plus a male ${moveList} carrier`
      : `one ${name}, plus a male ${moveList} carrier`
    if (foreign) {
      const foreignName = foreign.species[0] ?? 'parent'
      return `${body}; the ${foreignName} whose origin language differs from its partner`
    }
    return body
  }

  const name = facts[0]?.species[0] ?? 'parent'
  const body = hasNature
    ? `two ${name}, one with the target nature`
    : `two ${name}`
  if (foreign) {
    return `${body}; one whose origin language differs from its partner`
  }
  return body
}
