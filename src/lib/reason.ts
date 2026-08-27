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
  | { code: 'acquire-nature'; nature: string; how: string }
  | { code: 'mints-dont-pass' }
  | { code: 'acquire-hidden-can-pass'; ability: string; how: string }
  | { code: 'acquire-hidden-cannot-pass'; ability: string; how: string }
  | { code: 'acquire-standard-ability'; ability: string; how: string }
  | {
      code: 'acquire-egg-move-pair'
      species: string
      moves: string[]
      how: string
      passers: string[]
    }
  | {
      code: 'acquire-egg-move-ditto-alternative'
      species: string
      moves: string[]
      alternativeName: string
      alternativeHow: string
      passers: string[]
    }
  | {
      code: 'acquire-egg-move-ditto-father-only'
      species: string
      moves: string[]
    }
  | {
      code: 'acquire-egg-move-ditto-bootstrap'
      species: string
      moves: string[]
    }
  | { code: 'acquire-ditto'; obtainedAt: string }
  | { code: 'acquire-masuda'; how: string }
  | { code: 'egg-group-unknown'; species: string }
  | { code: 'egg-group-catalogued-empty'; species: string }

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

function formatPasserPreview(passers: string[]): string | null {
  if (passers.length === 0) return null
  if (passers.length <= 3) return passers.join(', ')
  return `${passers.slice(0, 3).join(', ')} (+${passers.length - 3} more)`
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
    case 'acquire-nature':
    case 'mints-dont-pass':
    case 'acquire-hidden-can-pass':
    case 'acquire-hidden-cannot-pass':
    case 'acquire-standard-ability':
    case 'acquire-egg-move-pair':
    case 'acquire-egg-move-ditto-alternative':
    case 'acquire-egg-move-ditto-father-only':
    case 'acquire-egg-move-ditto-bootstrap':
    case 'acquire-ditto':
    case 'acquire-masuda':
    case 'egg-group-unknown':
    case 'egg-group-catalogued-empty':
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
    case 'acquire-nature':
      return `Acquire a ${reason.nature} parent first: ${reason.how}`
    case 'mints-dont-pass':
      return "Nature Mints only change battle stats — a minted Pokémon still passes its original nature. An item that fixes a Pokémon for battle does not fix it for the daycare."
    case 'acquire-hidden-can-pass':
      return `${reason.ability} is a hidden ability — ${reason.how}`
    case 'acquire-hidden-cannot-pass':
      return `${reason.ability} cannot be passed via eggs here. ${reason.how}`
    case 'acquire-standard-ability':
      return `Acquire ${reason.ability}: ${reason.how}`
    case 'acquire-egg-move-pair': {
      const list = formatPasserPreview(reason.passers)
      const passerNote = list ? ` Concrete passers in this game: ${list}.` : ''
      return `Egg moves are not level-up moves for ${reason.species}.${passerNote} ${reason.how} Need: ${reason.moves.join(', ')}.`
    }
    case 'acquire-egg-move-ditto-alternative': {
      const list = formatPasserPreview(reason.passers)
      const picnicPartner = list
        ? ` Picnic with a partner that already knows the move — in this game that includes ${list}.`
        : ''
      return `Consolidate ${reason.moves.join(', ')} onto ${reason.species} first using ${reason.alternativeName}: ${reason.alternativeHow}${picnicPartner} Ditto only knows Transform and cannot pass egg moves.`
    }
    case 'acquire-egg-move-ditto-father-only':
      return `This route needs a male ${reason.species} that already knows ${reason.moves.join(', ')}. In this game that usually means hatching one from the species-pair route first (only the father passes egg moves); there is no separate teach-onto-the-line mechanic. Ditto only knows Transform and cannot pass egg moves.`
    case 'acquire-egg-move-ditto-bootstrap':
      return `This route needs a ${reason.species} that already knows ${reason.moves.join(', ')}. In this game that usually means getting the moves via the species-pair route first; there is no separate teach-onto-the-line mechanic. Ditto only knows Transform and cannot pass egg moves.`
    case 'acquire-ditto':
      return `Obtain Ditto: ${reason.obtainedAt.replace(/\.+$/, '')}.`
    case 'acquire-masuda':
      return reason.how
    case 'egg-group-unknown':
      return `no egg-group data is held for ${reason.species}`
    case 'egg-group-catalogued-empty':
      return `${reason.species} is in the catalog but has no egg-group membership recorded`
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
