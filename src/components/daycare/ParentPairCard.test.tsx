import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../../data/schema'
import gen3Json from '../../data/rulesets/gen3.json'
import gen9Json from '../../data/rulesets/gen9.json'
import frlgJson from '../../data/games/firered-leafgreen.json'
import {
  planDaycare,
  type PairingStrategy,
  type ParentRequirement,
} from '../../engine/daycareEngine'
import { parentOwnershipKey } from '../../lib/parentOwnership'
import ParentPairCard from './ParentPairCard'

const gen3 = gen3Json as Ruleset
const frlg = frlgJson as GameData

const gen9 = gen9Json as Ruleset

afterEach(() => {
  cleanup()
})

const parentA: ParentRequirement = {
  role: 'A',
  species: ['Charmander'],
  mustHaveNature: 'Timid',
  acquisition: [
    {
      severity: 'info',
      code: 'acquire-nature',
      nature: 'Timid',
      how: 'Hunt until Timid appears.',
    },
  ],
}

const strategy: PairingStrategy = {
  id: 'species-pair',
  label: 'Species pair',
  parents: [parentA, { role: 'B', species: ['Charmander'] }],
  acquisitionCost: 'two Charmander',
  tradeoff: 'Fixture tradeoff.',
}

describe('ParentPairCard owned parent', () => {
  it('keeps Get this parent first visible when the box is checked', () => {
    render(
      <ParentPairCard
        strategies={[strategy]}
        selectedStrategyId="species-pair"
        ruleset={gen9}
        onSelectStrategy={() => {}}
        ownedKeys={new Set([parentOwnershipKey(parentA)])}
        onToggleOwned={() => {}}
      />,
    )

    const heading = screen.getByText('Get this parent first')
    expect(heading.className).toMatch(/line-through/)
    expect(
      screen.getByText('Acquire a Timid parent first: Hunt until Timid appears.'),
    ).toBeTruthy()
  })
})

const dittoParent: ParentRequirement = {
  role: 'B',
  species: ['Ditto'],
  acquisition: [
    {
      severity: 'info',
      code: 'acquire-ditto',
      obtainedAt: 'Wild encounters in the test area.',
      satisfied: true,
    },
  ],
}

const dittoStrategy: PairingStrategy = {
  id: 'ditto-pair',
  label: 'Ditto pair',
  parents: [parentA, dittoParent],
  acquisitionCost: 'one Charmander with the target nature, plus a Ditto',
  tradeoff: 'Fixture tradeoff.',
}

describe('ParentPairCard owns-ditto', () => {
  it('keeps Obtain Ditto visible and struck when the claim is on', () => {
    render(
      <ParentPairCard
        strategies={[dittoStrategy]}
        selectedStrategyId="ditto-pair"
        ruleset={gen9}
        onSelectStrategy={() => {}}
        ownedKeys={new Set()}
        onToggleOwned={() => {}}
        ownsDitto
        onToggleOwnsDitto={() => {}}
      />,
    )

    const line = screen.getByText(
      /Obtain Ditto: Wild encounters in the test area/,
    )
    expect(line.className).toMatch(/line-through/)
    expect(
      screen.getByRole('checkbox', { name: 'I already have Ditto' }),
    ).toBeTruthy()
  })

  it('strikes only Obtain Ditto on the FRLG Dragon Dance follow-on', () => {
    const plan = planDaycare(frlg, gen3, {
      species: 'Charmander',
      nature: 'any',
      ability: 'any',
      eggMoves: ['Dragon Dance'],
      ivs: {
        hp: 'any',
        atk: 'any',
        def: 'any',
        spa: 'any',
        spd: 'any',
        spe: 'any',
      },
    }, [{ fact: 'owns-ditto' }])

    render(
      <ParentPairCard
        strategies={plan.strategies}
        selectedStrategyId="ditto-pair"
        ruleset={gen3}
        onSelectStrategy={() => {}}
        ownedKeys={new Set()}
        onToggleOwned={() => {}}
        ownsDitto
        onToggleOwnsDitto={() => {}}
      />,
    )

    const followOn = screen.getByText(
      /This pairing is a follow-on — it needs a hatch from Species pair that already knows Dragon Dance/,
    )
    expect(followOn.className).not.toMatch(/line-through/)

    const alreadyKnows = screen.getByText(
      /This route needs a male Charmander that already knows Dragon Dance/,
    )
    expect(alreadyKnows.className).not.toMatch(/line-through/)

    const statuses = screen.getAllByRole('status')
    const struck = statuses.filter((node) =>
      node.className.includes('line-through'),
    )
    expect(struck).toHaveLength(1)
    expect(struck[0]?.textContent).toMatch(/Obtain Ditto:/)
  })
})
