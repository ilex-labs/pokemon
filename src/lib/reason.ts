/**
 * Discriminated reasons the engine emits. Prose lives in formatReason —
 * same split as formatHatchOutcome: engine chooses a code, renderer
 * writes the sentence.
 */

export type Reason =
  | { code: 'female-species-holder'; offspringSpecies: string }
  | { code: 'female-ability-needs-ditto' }
  | { code: 'male-same-species-partner' }
  | { code: 'male-external-carrier'; carrierSpecies: string[] }
  | { code: 'male-egg-move-eligible' }
  | { code: 'everstone-guaranteed'; nature: string }
  | { code: 'everstone-chance'; nature: string }
  | {
      code: 'destiny-knot-iv'
      baseCountInherited: number
      destinyKnotBoostedCount: number
    }
  | { code: 'power-item-iv' }

type GenderedParts = {
  gender: 'male' | 'female'
  clause: string
}

function formatSpeciesList(names: string[]): string {
  if (names.length === 0) return 'that species'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} or ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`
}

/** Clause only — conclusion is applied once in formatGendered. */
function genderReasonParts(reason: Reason): GenderedParts | undefined {
  switch (reason.code) {
    case 'female-species-holder':
      return {
        gender: 'female',
        clause: `the female parent determines the offspring's species — eggs hatch as ${reason.offspringSpecies}`,
      }
    case 'female-ability-needs-ditto':
      return {
        gender: 'female',
        clause:
          'a male or genderless parent can only pass its ability when paired with Ditto',
      }
    case 'male-same-species-partner':
      return { gender: 'male', clause: "the pair can't both be female" }
    case 'male-external-carrier':
      if (reason.carrierSpecies.length === 1) {
        const name = reason.carrierSpecies[0]!
        return {
          gender: 'male',
          clause: `a female ${name} would produce ${name} eggs instead`,
        }
      }
      return {
        gender: 'male',
        clause: `a female of that species (${formatSpeciesList(reason.carrierSpecies)}) would produce its own eggs instead`,
      }
    case 'male-egg-move-eligible':
      return {
        gender: 'male',
        clause: 'only the father passes egg moves in this game',
      }
    case 'everstone-guaranteed':
    case 'everstone-chance':
    case 'destiny-knot-iv':
    case 'power-item-iv':
      return undefined
    default: {
      const _exhaustive: never = reason
      return _exhaustive
    }
  }
}

function formatGendered(gender: 'male' | 'female', clauses: string[]): string {
  const conclusion = gender === 'male' ? 'Male' : 'Female'
  if (clauses.length === 1) {
    return `${conclusion} because ${clauses[0]}.`
  }
  if (clauses.length === 2) {
    return `${conclusion} because ${clauses[0]}, and because ${clauses[1]}.`
  }
  const last = clauses[clauses.length - 1]
  const head = clauses.slice(0, -1).join(', ')
  return `${conclusion} because ${head}, and ${last}.`
}

export function formatReason(reason: Reason): string {
  switch (reason.code) {
    case 'female-species-holder':
    case 'female-ability-needs-ditto':
    case 'male-same-species-partner':
    case 'male-external-carrier':
    case 'male-egg-move-eligible': {
      const gendered = genderReasonParts(reason)
      if (!gendered) {
        throw new Error(`gender reason ${reason.code} is missing a clause`)
      }
      return formatGendered(gendered.gender, [gendered.clause])
    }
    case 'everstone-guaranteed':
      return `Guarantees the hatch inherits ${reason.nature}.`
    case 'everstone-chance':
      return `Gives a 50% chance the hatch inherits ${reason.nature}.`
    case 'destiny-knot-iv':
      return `Serves the IV target — raises inherited IVs from ${reason.baseCountInherited} to ${reason.destinyKnotBoostedCount}.`
    case 'power-item-iv':
      return 'Serves the IV target — locks one specific parent IV into the hatch.'
    default: {
      const _exhaustive: never = reason
      return _exhaustive
    }
  }
}

/**
 * Shared conclusion once; each reason contributes its clause.
 * Two clauses keep ", and because". Three or more are a series.
 */
export function formatReasons(reasons: Reason[]): string {
  if (reasons.length === 0) return ''
  const parts = reasons.map(genderReasonParts)
  const first = parts[0]
  if (
    first &&
    parts.every(
      (part): part is GenderedParts =>
        part != null && part.gender === first.gender,
    )
  ) {
    return formatGendered(
      first.gender,
      parts.map((part) => part.clause),
    )
  }
  return reasons.map(formatReason).join(' ')
}
