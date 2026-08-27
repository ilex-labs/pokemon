/**
 * Masuda odds that gen 9 does not ship. Gen 3 omits masudaMethod, so
 * 6/4096 and 683 are the only values the engine currently reads.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen9 = gen9Json as Ruleset
const scarletViolet = scarletVioletJson as GameData

const fixtureMasuda: Ruleset = {
  ...gen9,
  masudaMethod: { odds: '4/4096', approximateEggs: 1024 },
}

const shinyTarget: DaycareTarget = {
  species: 'Charmander',
  nature: 'any',
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
  wantsShiny: true,
}

describe('masudaMethod synthetic odds', () => {
  it('masuda tier odds and approximateEggs are 4/4096 and 1024, not gen 9\'s 6/4096 and 683', () => {
    const plan = planDaycare(scarletViolet, fixtureMasuda, shinyTarget)
    const masuda = plan.shiny?.tiers.find((tier) => tier.id === 'masuda')
    expect(masuda?.odds).toBe('4/4096')
    expect(masuda?.approximateEggs).toBe(1024)
    expect(masuda?.odds).not.toBe('6/4096')
    expect(masuda?.approximateEggs).not.toBe(683)
  })
})
