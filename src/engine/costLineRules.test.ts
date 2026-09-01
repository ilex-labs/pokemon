/**
 * Chooser cost-line rules against live shipped plans.
 * Presence and clause structure — not whole-string snapshots.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset, SpeciesEggData } from '../data/schema'
import { frlg, gen3, gen9, scarletViolet } from '../data/unwrapped'
import naturesJson from '../data/shared/natures.json'
import { formatReasons } from '../lib/reason'
import {
  planDaycare,
  type DaycareTarget,
  type ParentRequirement,
} from './daycareEngine'

const ANY_IVS: DaycareTarget['ivs'] = {
  hp: 'any',
  atk: 'any',
  def: 'any',
  spa: 'any',
  spd: 'any',
  spe: 'any',
}

function isAllocation(parent: ParentRequirement): boolean {
  return parent.genderKind === 'allocation'
}

function isRequiredGender(parent: ParentRequirement): boolean {
  return parent.gender != null && parent.genderKind === 'forced'
}

function encounterFraction(
  gender: 'male' | 'female',
  ratio: SpeciesEggData['genderRatio'],
): number {
  if (ratio === 'genderless') return 0
  if (ratio === 'male-only') return gender === 'male' ? 1 : 0
  if (ratio === 'female-only') return gender === 'female' ? 1 : 0
  const male = ratio.malePercent / 100
  return gender === 'male' ? male : 1 - male
}

function isMinority(
  parent: ParentRequirement,
  game: GameData,
): boolean {
  if (parent.gender == null) return false
  const fractions = parent.species
    .map((name) => game.species[name]?.genderRatio)
    .filter((ratio): ratio is SpeciesEggData['genderRatio'] => ratio != null)
    .map((ratio) => encounterFraction(parent.gender!, ratio))
  if (fractions.length === 0) return false
  return Math.max(...fractions) < 0.5
}

function shouldNameGender(
  parent: ParentRequirement,
  game: GameData,
): boolean {
  if (parent.gender == null) return false
  if (isRequiredGender(parent)) return true
  return isAllocation(parent) && isMinority(parent, game)
}

/** "one …" stretches. Comma and semicolon end a stretch. */
function onePhrases(line: string): string[] {
  return [...line.matchAll(/\bone\b[^;,]*/g)].map((match) => match[0].trim())
}

function namesTwoParents(line: string): boolean {
  return /\bplus a\b/.test(line)
}

describe('cost line rules on live shipped plans', () => {
  it('names an allocation gender when that side is the minority', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      species: 'Charmander',
      nature: 'Timid',
      ability: 'any',
      eggMoves: [],
      ivs: { ...ANY_IVS },
    })
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(speciesPair).toBeDefined()
    const minority = speciesPair!.parents.filter(
      (parent) => isAllocation(parent) && isMinority(parent, scarletViolet),
    )
    expect(minority.length).toBeGreaterThan(0)
    for (const parent of minority) {
      expect(parent.gender).toBe('female')
      expect(speciesPair!.acquisitionCost).toMatch(/\bfemale\b/)
    }
  })

  it('does not name an allocation gender that is not the minority', () => {
    const plan = planDaycare(frlg, gen3, {
      species: 'Gyarados',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: { ...ANY_IVS },
    })
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(speciesPair).toBeDefined()
    const allocated = speciesPair!.parents.filter((parent) => isAllocation(parent))
    expect(allocated.length).toBe(2)
    for (const parent of allocated) {
      expect(isMinority(parent, frlg)).toBe(false)
    }
    expect(speciesPair!.acquisitionCost).not.toMatch(/\bfemale\b/)
    expect(speciesPair!.acquisitionCost).not.toMatch(/\bmale\b/)
  })

  it('names a required gender regardless of ratio', () => {
    const plan = planDaycare(frlg, gen3, {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: ['Dragon Dance'],
      ivs: { ...ANY_IVS },
    })
    const ditto = plan.strategies.find((strategy) => strategy.id === 'ditto-pair')
    expect(ditto).toBeDefined()
    const required = ditto!.parents.filter((parent) => isRequiredGender(parent))
    expect(required).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gender: 'male' }),
      ]),
    )
    expect(ditto!.acquisitionCost).toMatch(/\bmale\b/)
  })

  it('keeps two facts about one parent in a single clause', () => {
    const plan = planDaycare(scarletViolet, gen9, {
      species: 'Charmander',
      nature: 'Timid',
      ability: 'any',
      eggMoves: [],
      ivs: { ...ANY_IVS },
    })
    const speciesPair = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(speciesPair).toBeDefined()
    const parent = speciesPair!.parents.find(
      (item) =>
        shouldNameGender(item, scarletViolet) && Boolean(item.mustHaveNature),
    )
    expect(parent?.gender).toBe('female')
    const phrases = onePhrases(speciesPair!.acquisitionCost)
    const combined = phrases.filter(
      (phrase) => /\bfemale\b/.test(phrase) && /target nature/.test(phrase),
    )
    expect(combined.length).toBeGreaterThan(0)
    expect(speciesPair!.acquisitionCost).not.toMatch(
      /one female, one with the target nature/,
    )
  })

  it('trails Masuda when the line names two parents, and attaches otherwise', () => {
    const twoParentPlan = planDaycare(scarletViolet, gen9, {
      species: 'Charmander',
      nature: 'Timid',
      ability: 'any',
      eggMoves: ['Dragon Dance'],
      ivs: { ...ANY_IVS },
      wantsShiny: true,
    })
    const carrier = twoParentPlan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(carrier).toBeDefined()
    expect(namesTwoParents(carrier!.acquisitionCost)).toBe(true)
    expect(carrier!.parents.some((parent) => parent.mustOriginateFromDifferentLanguage)).toBe(
      true,
    )
    const plusAt = carrier!.acquisitionCost.search(/\bplus a\b/)
    const masudaAt = carrier!.acquisitionCost.search(/origin language differs/)
    expect(masudaAt).toBeGreaterThan(plusAt)

    const sameSpeciesPlan = planDaycare(scarletViolet, gen9, {
      species: 'Charmander',
      nature: 'Timid',
      ability: 'any',
      eggMoves: [],
      ivs: { ...ANY_IVS },
      wantsShiny: true,
    })
    const pair = sameSpeciesPlan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(pair).toBeDefined()
    expect(namesTwoParents(pair!.acquisitionCost)).toBe(false)
    const foreign = pair!.parents.find(
      (parent) => parent.mustOriginateFromDifferentLanguage,
    )
    expect(foreign).toBeDefined()
    expect(shouldNameGender(foreign!, scarletViolet)).toBe(true)
    const attached = onePhrases(pair!.acquisitionCost).filter(
      (phrase) =>
        /\bfemale\b/.test(phrase) && /origin language differs/.test(phrase),
    )
    expect(attached.length).toBeGreaterThan(0)
  })
})

function abilitiesFor(spec: SpeciesEggData): string[] {
  const names = ['any', ...(spec.abilities.standard ?? [])]
  if (spec.abilities.hidden) names.push(spec.abilities.hidden)
  return names
}

function eggMoveOptions(game: GameData, species: string): string[][] {
  const move = game.eggMoves?.[species]?.[0]?.move
  return move ? [[], [move]] : [[]]
}

function shippedPlans(): Array<{
  game: GameData
  ruleset: Ruleset
  target: DaycareTarget
}> {
  const natures = ['any', ...Object.keys(naturesJson)]
  const out: Array<{
    game: GameData
    ruleset: Ruleset
    target: DaycareTarget
  }> = []
  for (const [game, ruleset] of [
    [scarletViolet, gen9],
    [frlg, gen3],
  ] as const) {
    for (const species of Object.keys(game.species)) {
      const spec = game.species[species]!
      for (const nature of natures) {
        for (const ability of abilitiesFor(spec)) {
          for (const eggMoves of eggMoveOptions(game, species)) {
            for (const wantsShiny of [false, true]) {
              out.push({
                game,
                ruleset,
                target: {
                  species,
                  nature,
                  ability,
                  eggMoves,
                  ivs: { ...ANY_IVS },
                  wantsShiny,
                },
              })
            }
          }
        }
      }
    }
  }
  return out
}

describe('composed gender reasons on live shipped parents', () => {
  it('joins stacked genderReasons into one conclusion, never repeated sentences', () => {
    let stacked = 0
    for (const entry of shippedPlans()) {
      const plan = planDaycare(entry.game, entry.ruleset, entry.target)
      for (const strategy of plan.strategies) {
        for (const parent of strategy.parents) {
          const reasons = parent.genderReason ?? []
          if (reasons.length < 2) continue
          stacked++
          const sentence = formatReasons(reasons)
          expect((sentence.match(/Male because/g) ?? []).length).toBeLessThanOrEqual(
            1,
          )
          expect((sentence.match(/Female because/g) ?? []).length).toBeLessThanOrEqual(
            1,
          )
          expect(sentence).not.toMatch(/\.\s+(?:Male|Female) because/)
        }
      }
    }
    expect(stacked).toBeGreaterThan(0)
  })
})
