/**
 * natureLock.holder female-or-ditto vs either-parent. Placement and
 * held-item reason must both name the restriction; gen 9 is the
 * unrestricted positive control.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { formatReason } from '../lib/reason'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen9 = gen9Json as Ruleset
const scarletViolet = scarletVioletJson as GameData

const fixtureHolderFemaleOrDitto: Ruleset = {
  ...gen9,
  natureLock: { method: 'everstone-chance', holder: 'female-or-ditto' },
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

function dittoPair(plan: ReturnType<typeof planDaycare>) {
  return plan.strategies.find((strategy) => strategy.id === 'ditto-pair')
}

function everstoneParent(
  plan: ReturnType<typeof planDaycare>,
  strategyId: string,
) {
  const strategy = plan.strategies.find((entry) => entry.id === strategyId)
  return strategy?.parents.find((parent) => parent.heldItem === 'Everstone')
}

describe('natureLock.holder', () => {
  it('female-or-ditto on everstone-chance: Everstone on female-or-Ditto, reason names the holder restriction', () => {
    const plan = planDaycare(scarletViolet, fixtureHolderFemaleOrDitto, natureOnly)

    const onDitto = everstoneParent(plan, 'ditto-pair')
    expect(onDitto?.species).toEqual(['Ditto'])
    expect(formatReason(onDitto!.heldItemReason!)).toMatch(/female or Ditto/i)

    const onSpecies = everstoneParent(plan, 'species-pair')
    expect(onSpecies?.gender).toBe('female')
    expect(onSpecies?.species).toEqual(['Charmander'])
    expect(formatReason(onSpecies!.heldItemReason!)).toMatch(/female or Ditto/i)
  })

  it('gen 9 either-parent: Everstone placement is not restricted to female-or-Ditto', () => {
    const plan = planDaycare(scarletViolet, gen9, natureOnly)
    expect(gen9.natureLock).toEqual({
      method: 'everstone-guaranteed',
      holder: 'either-parent',
    })

    const onDittoRoute = everstoneParent(plan, 'ditto-pair')
    expect(onDittoRoute?.species).toEqual(['Charmander'])
    expect(onDittoRoute?.species).not.toContain('Ditto')
    expect(onDittoRoute?.gender).toBeUndefined()

    const ditto = dittoPair(plan)?.parents.find((parent) =>
      parent.species.includes('Ditto'),
    )
    expect(ditto?.heldItem).not.toBe('Everstone')
  })
})
