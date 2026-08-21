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

function formatSpeciesList(names: string[]): string {
  if (names.length === 0) return 'that species'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} or ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}`
}

export function formatReason(reason: Reason): string {
  switch (reason.code) {
    case 'female-species-holder':
      return `Female because the female parent determines the offspring's species — eggs hatch as ${reason.offspringSpecies}.`
    case 'female-ability-needs-ditto':
      return 'Female because a male or genderless parent can only pass its ability when paired with Ditto.'
    case 'male-same-species-partner':
      return "Male because the pair can't both be female."
    case 'male-external-carrier':
      if (reason.carrierSpecies.length === 1) {
        const name = reason.carrierSpecies[0]!
        return `Male because a female ${name} would produce ${name} eggs instead.`
      }
      return `Male because a female of that species (${formatSpeciesList(reason.carrierSpecies)}) would produce its own eggs instead.`
    case 'male-egg-move-eligible':
      return 'Male because only the father passes egg moves in this game.'
    default: {
      const _exhaustive: never = reason
      return _exhaustive
    }
  }
}

/** Join multiple reasons the way the parent card used to: one paragraph. */
export function formatReasons(reasons: Reason[]): string {
  return reasons.map(formatReason).join(' ')
}
