import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Ruleset } from '../../data/schema'
import gen9Json from '../../data/rulesets/gen9.json'
import type { PairingStrategy, ParentRequirement } from '../../engine/daycareEngine'
import { parentOwnershipKey } from '../../lib/parentOwnership'
import ParentPairCard from './ParentPairCard'

const gen9 = gen9Json as Ruleset

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
