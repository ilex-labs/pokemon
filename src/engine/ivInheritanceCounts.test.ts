/**
 * IV inheritance counts that neither shipped ruleset uses. 3 and 5 would
 * not distinguish a hardcoded Destiny Knot reason.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen9 = gen9Json as Ruleset
const scarletViolet = scarletVioletJson as GameData

const fixtureIvCounts24: Ruleset = {
  ...gen9,
  ivInheritance: {
    ...gen9.ivInheritance,
    baseCountInherited: 2,
    destinyKnotBoostedCount: 4,
  },
}

const ivTarget: DaycareTarget = {
  species: 'Charmander',
  nature: 'any',
  ability: 'any',
  eggMoves: [],
  ivs: {
    hp: 31,
    atk: 0,
    def: 31,
    spa: 31,
    spd: 31,
    spe: 31,
  },
}

describe('ivInheritance synthetic counts', () => {
  it('destiny-knot-iv params are 2 and 4, not the shipped 3 and 5', () => {
    const plan = planDaycare(scarletViolet, fixtureIvCounts24, ivTarget)
    const reasons = plan.strategies.flatMap((strategy) =>
      strategy.parents.flatMap((parent) =>
        (parent.heldItemReason ?? []).filter(
          (reason) => reason.code === 'destiny-knot-iv',
        ),
      ),
    )

    expect(reasons.length).toBeGreaterThan(0)
    for (const reason of reasons) {
      expect(reason).toEqual({
        code: 'destiny-knot-iv',
        baseCountInherited: 2,
        destinyKnotBoostedCount: 4,
      })
      expect(reason).not.toMatchObject({
        baseCountInherited: 3,
        destinyKnotBoostedCount: 5,
      })
    }
  })
})
