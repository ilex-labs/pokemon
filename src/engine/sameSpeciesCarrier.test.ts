import { describe, expect, it } from 'vitest'
import type { GameData, Ruleset } from '../data/schema'
import gen9Json from '../data/rulesets/gen9.json'
import { formatReason } from '../lib/reason'
import {
  applyRouteRecommendations,
  chooserComparisonCopy,
  planDaycare,
  type DaycareTarget,
  type PairingStrategy,
} from './daycareEngine'

const gen9 = gen9Json as Ruleset
const maleOnly = {
  ...gen9,
  eggMoveEligibleParents: 'male-only',
} as Ruleset

const anyIvs: DaycareTarget['ivs'] = {
  hp: 'any',
  atk: 'any',
  def: 'any',
  spa: 'any',
  spd: 'any',
  spe: 'any',
}

const fixtureTarget: DaycareTarget = {
  species: 'FixtureMon',
  nature: 'any',
  ability: 'any',
  eggMoves: ['FixtureMove'],
  ivs: anyIvs,
}

function fixtureSpecies(name: string) {
  return {
    abilities: { standard: ['FixtureAbility'] },
    genderRatio: { malePercent: 50 },
    hatchesInto: name,
    eggCycles: 20,
  }
}

/** Catalog passer is the target itself — same-species carrier. */
const fixtureGameSameSpecies: GameData = {
  id: 'fixture-same-species-carrier',
  displayName: 'Fixture same-species carrier',
  generation: 9,
  eggGroups: { field: ['FixtureMon'] },
  species: { FixtureMon: fixtureSpecies('FixtureMon') },
  ditto: {
    available: true,
    universalParent: true,
    obtainedAt: 'Fixture Ditto location.',
  },
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixtureMon'] }],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes: [
    {
      routeName: 'Fixture walk',
      cycleCount: 'medium',
      method: 'Walk.',
    },
  ],
}

/** Catalog passer is a different species — external carrier. */
const fixtureGameExternalCarrier: GameData = {
  id: 'fixture-external-carrier',
  displayName: 'Fixture external carrier',
  generation: 9,
  eggGroups: {
    field: ['FixtureMon'],
    dragon: ['FixtureCarrier'],
  },
  species: {
    FixtureMon: fixtureSpecies('FixtureMon'),
    FixtureCarrier: fixtureSpecies('FixtureCarrier'),
  },
  ditto: {
    available: true,
    universalParent: true,
    obtainedAt: 'Fixture Ditto location.',
  },
  eggMoves: {
    FixtureMon: [{ move: 'FixtureMove', parentSpecies: ['FixtureCarrier'] }],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes: [
    {
      routeName: 'Fixture walk',
      cycleCount: 'medium',
      method: 'Walk.',
    },
  ],
}

/** Catalog lists the target and another species — union case. */
const fixtureGameUnion: GameData = {
  id: 'fixture-union-passers',
  displayName: 'Fixture union passers',
  generation: 9,
  eggGroups: {
    field: ['FixtureMon'],
    dragon: ['FixtureCarrier'],
  },
  species: {
    FixtureMon: fixtureSpecies('FixtureMon'),
    FixtureCarrier: fixtureSpecies('FixtureCarrier'),
  },
  ditto: {
    available: true,
    universalParent: true,
    obtainedAt: 'Fixture Ditto location.',
  },
  eggMoves: {
    FixtureMon: [
      {
        move: 'FixtureMove',
        parentSpecies: ['FixtureMon', 'FixtureCarrier'],
      },
    ],
  },
  eggMoveAcquisition: {
    how: 'Catch or hatch a parent that already knows FixtureMove.',
  },
  hatchRoutes: [
    {
      routeName: 'Fixture walk',
      cycleCount: 'medium',
      method: 'Walk.',
    },
  ],
}

function speciesPairParents(game: GameData, ruleset: Ruleset) {
  const plan = planDaycare(game, ruleset, fixtureTarget)
  const speciesPair = plan.strategies.find(
    (strategy) => strategy.id === 'species-pair',
  )
  return { plan, speciesPair, parents: speciesPair?.parents ?? [] }
}

describe('same-species egg-move carrier slot', () => {
  it('fixtureGameSameSpecies on gen 9: mustKnow and acquisition on exactly one parent', () => {
    const { parents } = speciesPairParents(fixtureGameSameSpecies, gen9)
    const carriers = parents.filter((parent) =>
      parent.mustKnow?.includes('FixtureMove'),
    )
    expect(carriers).toHaveLength(1)
    expect(carriers[0]?.role).toBe('B')
    expect(carriers[0]?.species).toEqual(['FixtureMon'])
    expect(
      carriers[0]?.acquisition?.some((flag) =>
        /FixtureMove/.test(formatReason(flag)),
      ),
    ).toBe(true)
    expect(
      carriers[0]?.acquisition?.some((flag) =>
        /Catch or hatch a parent that already knows FixtureMove/.test(
          formatReason(flag),
        ),
      ),
    ).toBe(true)
  })

  it('fixtureGameSameSpecies on male-only: carrier is male for egg-move eligibility, not species', () => {
    const { parents } = speciesPairParents(fixtureGameSameSpecies, maleOnly)
    const carrier = parents.find((parent) =>
      parent.mustKnow?.includes('FixtureMove'),
    )
    expect(carrier?.gender).toBe('male')
    expect(carrier?.genderReason).toEqual([{ code: 'male-egg-move-eligible' }])
  })

  it('fixtureGameExternalCarrier on male-only: male for egg-move eligibility only', () => {
    const { parents } = speciesPairParents(fixtureGameExternalCarrier, maleOnly)
    const carrier = parents.find((parent) =>
      parent.mustKnow?.includes('FixtureMove'),
    )
    expect(carrier?.species).toEqual(['FixtureCarrier'])
    expect(carrier?.gender).toBe('male')
    expect(carrier?.genderReason).toEqual([
      { code: 'male-egg-move-eligible' },
    ])
  })

  it('fixtureGameSameSpecies Ditto route: mustKnow on exactly one parent', () => {
    const plan = planDaycare(fixtureGameSameSpecies, gen9, fixtureTarget)
    const ditto = plan.strategies.find((strategy) => strategy.id === 'ditto-pair')
    const carriers = (ditto?.parents ?? []).filter(
      (parent) =>
        JSON.stringify(parent.mustKnow) ===
        JSON.stringify(fixtureTarget.eggMoves),
    )
    expect(carriers).toHaveLength(1)
  })

  it('every egg-move-capable strategy has exactly one mustKnow parent', () => {
    const plan = planDaycare(fixtureGameSameSpecies, gen9, fixtureTarget)
    const capable = plan.strategies.filter((strategy) =>
      strategy.parents.some((parent) =>
        parent.species.some((name) => name !== 'Ditto'),
      ),
    )
    const violations = capable
      .filter((strategy) => {
        const carriers = strategy.parents.filter(
          (parent) =>
            JSON.stringify(parent.mustKnow) ===
            JSON.stringify(fixtureTarget.eggMoves),
        )
        return carriers.length !== 1
      })
      .map((strategy) => strategy.id)
    expect(violations).toEqual([])
  })

  it('requiresRoute supplier is the hatch route by parent facts, not by id', () => {
    const supplier: PairingStrategy = {
      id: 'same-line-pair',
      label: 'Same-line pair',
      acquisitionCost: 'two FixtureMon',
      tradeoff: 'Pairs two of the target line.',
      parents: [
        { role: 'A', species: ['FixtureMon'] },
        {
          role: 'B',
          species: ['FixtureMon'],
          mustKnow: ['FixtureMove'],
          acquisition: [
            {
              severity: 'info',
              code: 'acquire-egg-move-pair',
              species: 'FixtureMon',
              moves: ['FixtureMove'],
              how: 'Catch or hatch a parent that already knows FixtureMove.',
              passers: [],
            },
          ],
        },
      ],
    }
    const consumer: PairingStrategy = {
      id: 'ditto-pair',
      label: 'Ditto pair',
      acquisitionCost: 'one FixtureMon that already knows FixtureMove, plus a Ditto',
      tradeoff: 'Depends on already having the move.',
      parents: [
        {
          role: 'A',
          species: ['FixtureMon'],
          gender: 'male',
          mustKnow: ['FixtureMove'],
          acquisition: [
            {
              severity: 'info',
              code: 'acquire-egg-move-ditto-father-only',
              species: 'FixtureMon',
              moves: ['FixtureMove'],
            },
          ],
        },
        { role: 'B', species: ['Ditto'] },
      ],
    }

    const { strategies } = applyRouteRecommendations(
      [supplier, consumer],
      fixtureGameSameSpecies,
    )
    const ditto = strategies.find((strategy) => strategy.id === 'ditto-pair')
    expect(ditto?.requiresRoute).toEqual({
      ids: ['same-line-pair'],
      reason: {
        code: 'requires-hatch-from-route',
        fromLabels: ['Same-line pair'],
        moves: ['FixtureMove'],
      },
    })
  })

  it('union catalog emits same-species and external species-pair routes', () => {
    const plan = planDaycare(fixtureGameUnion, gen9, fixtureTarget)
    expect(plan.strategies.map((strategy) => strategy.id)).toEqual([
      'species-pair-same',
      'species-pair-external',
      'ditto-pair',
    ])

    const same = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair-same',
    )
    const external = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair-external',
    )
    const sameB = same?.parents.find((parent) => parent.role === 'B')
    const externalB = external?.parents.find((parent) => parent.role === 'B')
    const sameA = same?.parents.find((parent) => parent.role === 'A')

    expect(sameB?.species).toEqual(['FixtureMon'])
    expect(sameB?.mustKnow).toEqual(['FixtureMove'])
    expect(
      sameB?.acquisition?.find((flag) => flag.code === 'acquire-egg-move-pair'),
    ).toMatchObject({
      code: 'acquire-egg-move-pair',
      passers: [],
    })
    expect(sameA?.gender).toBe('female')
    expect(sameA?.genderReason).toEqual([{ code: 'pair-opposite-genders' }])
    expect(sameA?.genderReason?.some((reason) => reason.code === 'female-species-holder')).not.toBe(
      true,
    )
    expect(sameB?.gender).toBe('male')
    expect(sameB?.genderReason).toEqual([{ code: 'pair-opposite-genders' }])

    expect(externalB?.species).toEqual(['FixtureCarrier'])
    expect(externalB?.mustKnow).toEqual(['FixtureMove'])
    expect(
      externalB?.acquisition?.find((flag) => flag.code === 'acquire-egg-move-pair'),
    ).toMatchObject({
      code: 'acquire-egg-move-pair',
      passers: ['FixtureCarrier'],
    })
    expect(externalB?.gender).toBeUndefined()
    expect(externalB?.genderReason).toBeUndefined()
    expect(
      external?.parents
        .find((parent) => parent.role === 'A')
        ?.genderReason?.some((reason) => reason.code === 'female-species-holder'),
    ).not.toBe(true)
  })

  it('union catalog on male-only keeps egg-move eligibility on both pair routes', () => {
    const plan = planDaycare(fixtureGameUnion, maleOnly, fixtureTarget)
    const sameB = plan.strategies
      .find((strategy) => strategy.id === 'species-pair-same')
      ?.parents.find((parent) => parent.role === 'B')
    const externalB = plan.strategies
      .find((strategy) => strategy.id === 'species-pair-external')
      ?.parents.find((parent) => parent.role === 'B')

    expect(sameB?.gender).toBe('male')
    expect(sameB?.genderReason).toEqual([{ code: 'male-egg-move-eligible' }])
    expect(externalB?.genderReason).toEqual([
      { code: 'male-egg-move-eligible' },
    ])
  })

  it('union catalog names both hatch suppliers when cost cannot pick one', () => {
    const plan = planDaycare(fixtureGameUnion, gen9, fixtureTarget)
    const same = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair-same',
    )
    const external = plan.strategies.find(
      (strategy) => strategy.id === 'species-pair-external',
    )
    const ditto = plan.strategies.find((strategy) => strategy.id === 'ditto-pair')

    expect(same?.recommended).toBeUndefined()
    expect(external?.recommended).toBeUndefined()
    expect(ditto?.recommended).toBeUndefined()
    expect(ditto?.requiresRoute).toEqual({
      ids: ['species-pair-same', 'species-pair-external'],
      reason: {
        code: 'requires-hatch-from-route',
        fromLabels: ['Same-species pair', 'External carrier'],
        moves: ['FixtureMove'],
      },
    })
    expect(formatReason(ditto!.requiresRoute!.reason)).toBe(
      'This pairing is a follow-on — it needs a hatch from Same-species pair or External carrier that already knows FixtureMove.',
    )
    expect(plan.routeComparisons).toEqual([
      {
        a: 'species-pair-same',
        b: 'species-pair-external',
        outcome: 'incomparable',
        gDiffers: true,
        qOnlyA: ['moves:same-species:FixtureMove'],
        qOnlyB: ['moves:carrier:FixtureMove'],
      },
      {
        a: 'species-pair-same',
        b: 'ditto-pair',
        outcome: 'incomparable',
        gDiffers: true,
        qOnlyA: ['moves:same-species:FixtureMove'],
        qOnlyB: ['moves:already-knows:FixtureMove'],
      },
      {
        a: 'species-pair-external',
        b: 'ditto-pair',
        outcome: 'incomparable',
        gDiffers: false,
        qOnlyA: ['moves:carrier:FixtureMove'],
        qOnlyB: ['moves:already-knows:FixtureMove'],
      },
    ])
    const comparisonCopy = chooserComparisonCopy(
      plan.routeComparisons,
      plan.strategies,
    )
    expect(comparisonCopy).toEqual({
      kind: 'incomparable',
      reason: {
        code: 'incomparable-routes',
        aLabel: 'Same-species pair',
        bLabel: 'External carrier',
        gVersusExtra: false,
        left: ['same-species'],
        right: ['carrier'],
      },
    })
    expect(
      comparisonCopy?.kind === 'incomparable'
        ? formatReason(comparisonCopy.reason)
        : null,
    ).toBe(
      "Same-species pair and External carrier aren't comparable — passing the move on the line and using another species as a carrier aren't the same kind of work.",
    )
  })

  it('picks the cheaper hatch supplier even when it is not first in the array', () => {
    const expensive: PairingStrategy = {
      id: 'expensive-pair',
      label: 'Expensive pair',
      acquisitionCost: 'two FixtureMon',
      tradeoff: 'Genders constrained.',
      parents: [
        {
          role: 'A',
          species: ['FixtureMon'],
          gender: 'female',
        },
        {
          role: 'B',
          species: ['FixtureMon'],
          gender: 'male',
          mustKnow: ['FixtureMove'],
          acquisition: [
            {
              severity: 'info',
              code: 'acquire-egg-move-pair',
              species: 'FixtureMon',
              moves: ['FixtureMove'],
              how: 'Catch or hatch a parent that already knows FixtureMove.',
              passers: [],
            },
          ],
        },
      ],
    }
    const cheaper: PairingStrategy = {
      id: 'cheaper-pair',
      label: 'Cheaper pair',
      acquisitionCost: 'two FixtureMon',
      tradeoff: 'No gender hunt.',
      parents: [
        { role: 'A', species: ['FixtureMon'] },
        {
          role: 'B',
          species: ['FixtureMon'],
          mustKnow: ['FixtureMove'],
          acquisition: [
            {
              severity: 'info',
              code: 'acquire-egg-move-pair',
              species: 'FixtureMon',
              moves: ['FixtureMove'],
              how: 'Catch or hatch a parent that already knows FixtureMove.',
              passers: [],
            },
          ],
        },
      ],
    }
    const consumer: PairingStrategy = {
      id: 'ditto-pair',
      label: 'Ditto pair',
      acquisitionCost:
        'one FixtureMon that already knows FixtureMove, plus a Ditto',
      tradeoff: 'Depends on already having the move.',
      parents: [
        {
          role: 'A',
          species: ['FixtureMon'],
          mustKnow: ['FixtureMove'],
          acquisition: [
            {
              severity: 'info',
              code: 'acquire-egg-move-ditto-bootstrap',
              species: 'FixtureMon',
              moves: ['FixtureMove'],
            },
          ],
        },
        { role: 'B', species: ['Ditto'] },
      ],
    }

    const { strategies } = applyRouteRecommendations(
      [expensive, cheaper, consumer],
      fixtureGameSameSpecies,
    )
    expect(strategies.find((strategy) => strategy.id === 'cheaper-pair')?.recommended).toBe(
      true,
    )
    expect(
      strategies.find((strategy) => strategy.id === 'expensive-pair')?.recommended,
    ).toBeUndefined()
    expect(
      strategies.find((strategy) => strategy.id === 'ditto-pair')?.requiresRoute,
    ).toEqual({
      ids: ['cheaper-pair'],
      reason: {
        code: 'requires-hatch-from-route',
        fromLabels: ['Cheaper pair'],
        moves: ['FixtureMove'],
      },
    })
  })
})
