import type { Ruleset, SpeciesEggData } from '../data/schema'

/**
 * Hatch-as / hatch-level sentence shown under “What you need”.
 * Pure: no React, no store. Level comes from the ruleset.
 */
export function formatHatchOutcome(
  ruleset: Ruleset,
  species: SpeciesEggData,
  requestedSpecies: string,
): string {
  const offspring = species.hatchesInto
  const line = `Eggs hatch as ${offspring} at level ${ruleset.hatchLevel}.`
  if (requestedSpecies !== offspring) {
    return `${line} If you need ${requestedSpecies} specifically, hatch ${offspring} and evolve it.`
  }
  return line
}
