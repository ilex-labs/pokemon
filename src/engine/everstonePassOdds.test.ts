/**
 * Everstone chance passOdds that a 50% renderer literal would hide.
 * No shipped ruleset uses everstone-chance; 0.25 is not the historical 0.5.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import { gen9, scarletViolet } from '../data/unwrapped'
import { formatReason } from '../lib/reason'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const fixtureChance25: Ruleset = {
  ...gen9,
  natureLock: {
    method: 'everstone-chance',
    holder: 'either-parent',
    passOdds: 0.25,
  },
}

const natureOnly: DaycareTarget = {
  species: 'Charmander',
  nature: 'Timid',
  ability: 'any',
  eggMoves: [],
  ivs: {
    hp: 'any',
    atk: 'any',
    def: 'any',
    spa: 'any',
    spd: 'any',
    spe: 'any',
  },
}

describe('natureLock everstone-chance passOdds', () => {
  it('copies 0.25 onto the reason and renders 25%, not 50%', () => {
    const plan = planDaycare(scarletViolet, fixtureChance25, natureOnly)
    const reasons = plan.strategies.flatMap((strategy) =>
      strategy.parents.flatMap((parent) =>
        (parent.heldItemReason ?? []).filter(
          (reason) => reason.code === 'everstone-chance',
        ),
      ),
    )
    expect(reasons.length).toBeGreaterThan(0)
    for (const reason of reasons) {
      expect(reason).toEqual({
        code: 'everstone-chance',
        nature: 'Timid',
        passOdds: 0.25,
      })
      expect(formatReason(reason)).toBe(
        'Gives a 25% chance the hatch inherits Timid.',
      )
      expect(formatReason(reason)).not.toMatch(/50%/)
    }
  })
})
