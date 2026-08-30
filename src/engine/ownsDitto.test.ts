import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen3Json from '../data/rulesets/gen3.json'
import gen9Json from '../data/rulesets/gen9.json'
import frlgJson from '../data/games/firered-leafgreen.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import naturesJson from '../data/shared/natures.json'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen3 = gen3Json as Ruleset
const gen9 = gen9Json as Ruleset
const frlg = frlgJson as GameData
const scarletViolet = scarletVioletJson as GameData

const ANY_IVS: DaycareTarget['ivs'] = {
  hp: 'any',
  atk: 'any',
  def: 'any',
  spa: 'any',
  spd: 'any',
  spe: 'any',
}

const timid: DaycareTarget = {
  species: 'Charmander',
  nature: 'Timid',
  ability: 'any',
  eggMoves: [],
  ivs: { ...ANY_IVS },
}

const ownsDitto = [{ fact: 'owns-ditto' as const }]

function dittoFlags(plan: ReturnType<typeof planDaycare>) {
  return plan.strategies.flatMap((strategy) =>
    strategy.parents.flatMap((parent) =>
      (parent.acquisition ?? []).filter((flag) => flag.code === 'acquire-ditto'),
    ),
  )
}

describe('owns-ditto annotates acquire-ditto', () => {
  it('keeps the flag and marks it satisfied', () => {
    const plain = planDaycare(scarletViolet, gen9, timid)
    const owned = planDaycare(scarletViolet, gen9, timid, ownsDitto)
    const before = dittoFlags(plain)
    const after = dittoFlags(owned)
    expect(before.length).toBeGreaterThan(0)
    expect(after).toHaveLength(before.length)
    expect(before.every((flag) => !flag.satisfied)).toBe(true)
    expect(after.every((flag) => flag.satisfied === true)).toBe(true)
  })

  it('does not emit acquire-ditto on an unconstrained plan, even with the claim', () => {
    const unconstrained: DaycareTarget = {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: [],
      ivs: { ...ANY_IVS },
    }
    const plan = planDaycare(scarletViolet, gen9, unconstrained, ownsDitto)
    expect(dittoFlags(plan)).toEqual([])
  })

  it('does not emit acquire-ditto when Masuda is on, even with the claim', () => {
    const masuda: DaycareTarget = {
      ...timid,
      wantsShiny: true,
    }
    const plan = planDaycare(scarletViolet, gen9, masuda, ownsDitto)
    expect(dittoFlags(plan)).toEqual([])
  })

  it('does not satisfy the FRLG already-knows flag or drop the follow-on', () => {
    const target: DaycareTarget = {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: ['Dragon Dance'],
      ivs: { ...ANY_IVS },
    }
    const plain = planDaycare(frlg, gen3, target)
    const owned = planDaycare(frlg, gen3, target, ownsDitto)
    const ditto =
      owned.strategies.find((strategy) => strategy.id === 'ditto-pair')
    const charmander = ditto?.parents.find((parent) =>
      parent.species.includes('Charmander'),
    )
    const alreadyKnows = (charmander?.acquisition ?? []).filter(
      (flag) => flag.code === 'acquire-egg-move-ditto-father-only',
    )
    expect(alreadyKnows.length).toBeGreaterThan(0)
    expect(alreadyKnows.every((flag) => !flag.satisfied)).toBe(true)
    expect(ditto?.requiresRoute).toEqual(
      plain.strategies.find((strategy) => strategy.id === 'ditto-pair')
        ?.requiresRoute,
    )
    expect(dittoFlags(owned).every((flag) => flag.satisfied === true)).toBe(
      true,
    )
  })

  it('does not change route comparisons, cost lines, or recommendations', () => {
    const natures = ['any', ...Object.keys(naturesJson)]
    const games: Array<{ game: GameData; ruleset: Ruleset }> = [
      { game: scarletViolet, ruleset: gen9 },
      { game: frlg, ruleset: gen3 },
    ]
    let compared = 0
    for (const { game, ruleset } of games) {
      for (const species of Object.keys(game.species)) {
        const spec = game.species[species]!
        const abilities = [
          'any',
          ...spec.abilities.standard,
          ...(spec.abilities.hidden ? [spec.abilities.hidden] : []),
        ]
        const move = game.eggMoves?.[species]?.[0]?.move
        const eggOptions = move ? [[], [move]] : [[]]
        for (const nature of natures) {
          for (const ability of abilities) {
            for (const eggMoves of eggOptions) {
              for (const wantsShiny of [false, true]) {
                const target: DaycareTarget = {
                  species,
                  nature,
                  ability,
                  eggMoves,
                  ivs: { ...ANY_IVS },
                  wantsShiny,
                }
                const plain = planDaycare(game, ruleset, target)
                const owned = planDaycare(game, ruleset, target, ownsDitto)
                compared++
                expect(owned.routeComparisons).toEqual(plain.routeComparisons)
                expect(
                  owned.strategies.map((strategy) => ({
                    id: strategy.id,
                    cost: strategy.acquisitionCost,
                    recommended: strategy.recommended,
                    recommendReason: strategy.recommendReason,
                  })),
                ).toEqual(
                  plain.strategies.map((strategy) => ({
                    id: strategy.id,
                    cost: strategy.acquisitionCost,
                    recommended: strategy.recommended,
                    recommendReason: strategy.recommendReason,
                  })),
                )
              }
            }
          }
        }
      }
    }
    expect(compared).toBe(624)
  })
})
