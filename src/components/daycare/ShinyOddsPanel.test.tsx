import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { frlg, gen3, gen9, scarletViolet } from '../../data/unwrapped'
import { planDaycare, type DaycareTarget } from '../../engine/daycareEngine'
import ShinyOddsPanel from './ShinyOddsPanel'

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
    expect(
      screen.getByText(/2\/4096/),
    ).toBeTruthy()
    expect(screen.getByText(/Single source: Bulbapedia\./)).toBeTruthy()
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
