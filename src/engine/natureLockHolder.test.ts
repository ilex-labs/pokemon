/**
 * natureLock.holder female-or-ditto vs either-parent. Placement and
 * held-item reasons are independent: item effect is one code, holder
 * restriction is another. Gen 9 either-parent is the one-reason control.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
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

const everstoneChanceAndHolder = [
  { code: 'everstone-chance', nature: 'Timid' },
  { code: 'holder-female-or-ditto' },
] as const

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
  it('female-or-ditto on everstone-chance: both routes place the stone and emit effect plus holder restriction', () => {
    const plan = planDaycare(scarletViolet, fixtureHolderFemaleOrDitto, natureOnly)

    const onDitto = everstoneParent(plan, 'ditto-pair')
    expect(onDitto?.species).toEqual(['Ditto'])
    expect(onDitto?.heldItemReason).toEqual([...everstoneChanceAndHolder])

    const onSpecies = everstoneParent(plan, 'species-pair')
    expect(onSpecies?.gender).toBe('female')
    expect(onSpecies?.species).toEqual(['Charmander'])
    expect(onSpecies?.heldItemReason).toEqual([...everstoneChanceAndHolder])
  })

  it('gen 9 either-parent: Everstone placement is not restricted; exactly one reason', () => {
    const plan = planDaycare(scarletViolet, gen9, natureOnly)
    expect(gen9.natureLock).toEqual({
      method: 'everstone-guaranteed',
      holder: 'either-parent',
    })

    const onDittoRoute = everstoneParent(plan, 'ditto-pair')
    expect(onDittoRoute?.species).toEqual(['Charmander'])
    expect(onDittoRoute?.species).not.toContain('Ditto')
    expect(onDittoRoute?.gender).toBeUndefined()
    expect(onDittoRoute?.heldItemReason).toEqual([
      { code: 'everstone-guaranteed', nature: 'Timid' },
    ])
    expect(onDittoRoute?.heldItemReason).toHaveLength(1)

    const ditto = dittoPair(plan)?.parents.find((parent) =>
      parent.species.includes('Ditto'),
    )
    expect(ditto?.heldItem).not.toBe('Everstone')
  })
})
