/**
 * Ability pass rates that neither shipped ruleset uses while inheritance
 * exists. Gen 3's zeros sit behind inheritanceExists: false, so 0.8 / 0.6
 * are the only values the engine currently reads.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { formatReason } from '../lib/reason'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen9 = gen9Json as Ruleset
const scarletViolet = scarletVioletJson as GameData

const fixtureOdds: Ruleset = {
  ...gen9,
  abilityInheritance: {
    ...gen9.abilityInheritance,
    inheritanceExists: true,
    standardOdds: 0.5,
    hiddenOdds: 0.25,
  },
}

const dualStandard: GameData = {
  ...scarletViolet,
  species: {
    ...scarletViolet.species,
    Charmander: {
      ...scarletViolet.species.Charmander,
      abilities: {
        standard: ['Blaze', 'Flash Fire'],
        hidden: 'Solar Power',
      },
    },
  },
}

const unconstrained: DaycareTarget['ivs'] = {
  hp: 'any',
  atk: 'any',
  def: 'any',
  spa: 'any',
  spd: 'any',
  spe: 'any',
}

describe('abilityInheritance synthetic odds', () => {
  it('standardOdds 0.5 is in the inherit instruction, not 80%', () => {
    const plan = planDaycare(dualStandard, fixtureOdds, {
      species: 'Charmander',
      nature: 'any',
      ability: 'Blaze',
      eggMoves: [],
      ivs: unconstrained,
    })
    const step = plan.steps.find((entry) => entry.id === 'ability')
    expect(step?.instruction).toMatch(/50%/)
    expect(step?.instruction).not.toMatch(/80%/)
    expect(step?.instruction).not.toMatch(/60%/)
    expect(step?.ruleFlags ?? []).toEqual([])
  })

  it('hiddenOdds 0.25 is in the instruction, flag params, and rendered flag', () => {
    const plan = planDaycare(scarletViolet, fixtureOdds, {
      species: 'Charmander',
      nature: 'any',
      ability: 'Solar Power',
      eggMoves: [],
      ivs: unconstrained,
    })
    const step = plan.steps.find((entry) => entry.id === 'ability')
    expect(step?.instruction).toMatch(/25%/)
    expect(step?.instruction).not.toMatch(/60%/)
    expect(step?.instruction).not.toMatch(/80%/)

    const flag = step?.ruleFlags?.find(
      (entry) => entry.code === 'hidden-ability-lower-rate',
    )
    expect(flag).toMatchObject({
      code: 'hidden-ability-lower-rate',
      hiddenOdds: 0.25,
      standardOdds: 0.5,
    })
    const prose = formatReason(flag!)
    expect(prose).toMatch(/25%/)
    expect(prose).toMatch(/50%/)
    expect(prose).not.toMatch(/60%/)
    expect(prose).not.toMatch(/80%/)
  })
})
