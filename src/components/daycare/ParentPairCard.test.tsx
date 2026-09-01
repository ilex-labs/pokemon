import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../../data/schema'
import { frlg, gen3, gen9, scarletViolet } from '../../data/unwrapped'
import {
  planDaycare,
  type PairingStrategy,
  type ParentRequirement,
} from '../../engine/daycareEngine'
import { parentOwnershipKey } from '../../lib/parentOwnership'
import ParentPairCard from './ParentPairCard'

const GENDER_REASON_GAP = 'Not recorded yet. No reason for this gender.'

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

function renderPair(parents: ParentRequirement[]) {
  const pair: PairingStrategy = {
    id: 'species-pair',
    label: 'Species pair',
    parents,
    acquisitionCost: 'two Charmander',
    tradeoff: 'Fixture tradeoff.',
  }
  render(
    <ParentPairCard
      strategies={[pair]}
      selectedStrategyId="species-pair"
      ruleset={gen9}
      onSelectStrategy={() => {}}
      ownedKeys={new Set()}
      onToggleOwned={() => {}}
    />,
  )
}

describe('ParentPairCard gender reason gap', () => {
  it('renders a muted gap for a forced gender with no reason', () => {
    renderPair([
      {
        role: 'A',
        species: ['Charmander'],
        gender: 'female',
        genderKind: 'forced',
      },
      { role: 'B', species: ['Charmander'] },
    ])
    const gap = screen.getByText(GENDER_REASON_GAP)
    expect(gap.className).toMatch(/text-muted/)
  })

  it('does not render the gap when a reason is present', () => {
    renderPair([
      {
        role: 'A',
        species: ['Charmander'],
        gender: 'female',
        genderKind: 'forced',
        genderReason: [
          {
            code: 'female-species-holder',
            offspringSpecies: 'Charmander',
            determinationFact: 'The female parent determines the offspring species.',
          },
        ],
      },
      { role: 'B', species: ['Charmander'] },
    ])
    expect(screen.queryByText(GENDER_REASON_GAP)).toBeNull()
    expect(screen.getByText(/female parent determines/i)).toBeTruthy()
  })

  it('does not render the gap for allocation without a reason', () => {
    renderPair([
      {
        role: 'A',
        species: ['Charmander'],
        gender: 'female',
        genderKind: 'allocation',
      },
      { role: 'B', species: ['Charmander'] },
    ])
    expect(screen.queryByText(GENDER_REASON_GAP)).toBeNull()
  })

  it('fires on an omit-speciesDetermination plan and not on a sourced game', () => {
    const { speciesDetermination: _omit, ...omitSv } = scarletViolet
    const target = {
      species: 'Charmander',
      nature: 'any' as const,
      ability: 'any' as const,
      eggMoves: ['Dragon Dance'],
      ivs: {
        hp: 'any' as const,
        atk: 'any' as const,
        def: 'any' as const,
        spa: 'any' as const,
        spd: 'any' as const,
        spe: 'any' as const,
      },
    }
    const omitPlan = planDaycare(omitSv, gen9, target)
    const omitPair = omitPlan.strategies.find(
      (strategy) => strategy.id === 'species-pair',
    )
    expect(omitPair).toBeDefined()
    render(
      <ParentPairCard
        strategies={omitPlan.strategies}
        selectedStrategyId="species-pair"
        ruleset={gen9}
        onSelectStrategy={() => {}}
        ownedKeys={new Set()}
        onToggleOwned={() => {}}
      />,
    )
    expect(screen.getAllByText(GENDER_REASON_GAP).length).toBe(2)
    cleanup()

    const sourced = planDaycare(scarletViolet, gen9, target)
    render(
      <ParentPairCard
        strategies={sourced.strategies}
        selectedStrategyId="species-pair"
        ruleset={gen9}
        onSelectStrategy={() => {}}
        ownedKeys={new Set()}
        onToggleOwned={() => {}}
      />,
    )
    expect(screen.queryByText(GENDER_REASON_GAP)).toBeNull()
  })
})
