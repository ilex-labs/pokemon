/**
 * Hyper Training level that neither shipped ruleset uses while available.
 * Gen 3's 0 sits behind available: false, so 50 is the only value read.
 */
import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import scarletVioletJson from '../data/games/scarlet-violet.json'
import { formatReason } from '../lib/reason'
import { planDaycare, type DaycareTarget } from './daycareEngine'

const gen9 = gen9Json as Ruleset
const scarletViolet = scarletVioletJson as GameData

const fixtureLevel100: Ruleset = {
  ...gen9,
  hyperTraining: {
    available: true,
    levelRequired: 100,
  },
}

const allMax: DaycareTarget = {
  species: 'Charmander',
  nature: 'any',
  ability: 'any',
  eggMoves: [],
  ivs: {
    hp: 31,
    atk: 31,
    def: 31,
    spa: 31,
    spd: 31,
    spe: 31,
  },
}

function hyperFlag(plan: ReturnType<typeof planDaycare>) {
  const ivBase = plan.steps.find((step) => step.id === 'iv-base')
  return ivBase?.ruleFlags?.find(
    (flag) => flag.code === 'hyper-effort' || flag.code === 'hyper-no-access',
  )
}

describe('hyperTraining synthetic levelRequired', () => {
  it('hyper-effort params and rendered sentence use 100, not 50', () => {
    const plan = planDaycare(scarletViolet, fixtureLevel100, allMax)
    const flag = hyperFlag(plan)
    expect(flag?.code).toBe('hyper-effort')
    expect(flag).toMatchObject({ level: 100 })
    expect(flag).not.toMatchObject({ level: 50 })
    const prose = formatReason(flag!)
    expect(prose).toMatch(/level 100/)
    expect(prose).not.toMatch(/level 50/)
  })

  it('hyper-no-access params and rendered sentence use 100, not 50', () => {
    const { hyperTrainingAccess: _omitted, ...noAccess } = scarletViolet
    const plan = planDaycare(noAccess, fixtureLevel100, allMax)
    const flag = hyperFlag(plan)
    expect(flag?.code).toBe('hyper-no-access')
    expect(flag).toMatchObject({ level: 100 })
    expect(flag).not.toMatchObject({ level: 50 })
    const prose = formatReason(flag!)
    expect(prose).toMatch(/level 100/)
    expect(prose).not.toMatch(/level 50/)
  })
})
