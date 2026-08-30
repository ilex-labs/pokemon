import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../../data/schema'
import gen3Json from '../../data/rulesets/gen3.json'
import gen9Json from '../../data/rulesets/gen9.json'
import frlgJson from '../../data/games/firered-leafgreen.json'
import scarletVioletJson from '../../data/games/scarlet-violet.json'
import { planDaycare, type DaycareTarget } from '../../engine/daycareEngine'
import ShinyOddsPanel from './ShinyOddsPanel'

const gen3 = gen3Json as Ruleset
const gen9 = gen9Json as Ruleset
const frlg = frlgJson as GameData
const scarletViolet = scarletVioletJson as GameData

afterEach(() => {
  cleanup()
})

const target: DaycareTarget = {
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

describe('ShinyOddsPanel sourced absence vs data gap', () => {
  it('shipped FRLG never takes the unsourced fallback; sourced copy is body', () => {
    expect(frlg.noEggShinyBoostsReason).toMatch(/Masuda Method doesn't exist/i)
    const plan = planDaycare(frlg, gen3, target)
    expect(plan.shiny?.noBoostsIsGap).toBeUndefined()
    expect(plan.shiny?.noBoostsReason).toMatch(/Masuda Method doesn't exist/i)

    render(<ShinyOddsPanel shiny={plan.shiny!} />)
    const sourced = screen.getByText(/Masuda Method doesn't exist/)
    expect(sourced.className).not.toMatch(/text-muted/)
    expect(screen.queryByText(/Not recorded yet/)).toBeNull()
    expect(screen.queryByText(/Nothing in this game improves/)).toBeNull()
  })

  it('shipped SV never takes the unsourced fallback', () => {
    expect(gen9.masudaMethod).toBeDefined()
    const plan = planDaycare(scarletViolet, gen9, target)
    expect(plan.shiny?.noBoostsReason).toBeUndefined()
    expect(plan.shiny?.noBoostsIsGap).toBeUndefined()

    render(<ShinyOddsPanel shiny={plan.shiny!} />)
    expect(screen.queryByText(/Not recorded yet/)).toBeNull()
    expect(screen.queryByText(/Nothing in this game improves/)).toBeNull()
  })

  it('renders a muted gap when noEggShinyBoostsReason is missing', () => {
    const { noEggShinyBoostsReason: _omit, ...unsourced } = frlg
    const plan = planDaycare(unsourced, gen3, target)
    expect(plan.shiny?.noBoostsIsGap).toBe(true)
    expect(plan.shiny?.noBoostsReason).toBeUndefined()

    render(<ShinyOddsPanel shiny={plan.shiny!} />)
    const gap = screen.getByText(
      'Not recorded yet. No egg-shiny boosts for this game.',
    )
    expect(gap.className).toMatch(/text-muted/)
    expect(screen.queryByText(/Nothing in this game improves/)).toBeNull()
  })
})
