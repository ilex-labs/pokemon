import { describe, expect, it } from 'vitest'
import {
  compareRouteCosts,
  deriveAcquisitionCost,
  formatAcquisitionCost,
  genderProduct,
  type AcquisitionCost,
  type ParentAcquisitionFact,
} from './acquisitionCost'
import type { GameData } from '../data/schema'

const CHARMANDER_RATIO = { malePercent: 87.5 }

function parent(
  partial: Partial<ParentAcquisitionFact> &
    Pick<ParentAcquisitionFact, 'species'>,
): ParentAcquisitionFact {
  return {
    genderConstrained: false,
    cataloguedGenderRatio: [],
    mustKnowMoves: false,
    moves: [],
    mustOriginateFromDifferentLanguage: false,
    isDitto: false,
    hasTargetNature: false,
    eggMoveRole: 'none',
    ...partial,
  }
}

function cost(parents: ParentAcquisitionFact[]): AcquisitionCost {
  return { parents }
}

const speciesPairNature: AcquisitionCost = cost([
  parent({
    species: ['Charmander'],
    genderConstrained: true,
    gender: 'female',
    cataloguedGenderRatio: [
      { species: 'Charmander', ratio: CHARMANDER_RATIO },
    ],
    hasTargetNature: true,
  }),
  parent({
    species: ['Charmander'],
    genderConstrained: true,
    gender: 'male',
    cataloguedGenderRatio: [
      { species: 'Charmander', ratio: CHARMANDER_RATIO },
    ],
  }),
])

const dittoPairNature: AcquisitionCost = cost([
  parent({
    species: ['Charmander'],
    hasTargetNature: true,
  }),
  parent({
    species: ['Ditto'],
    isDitto: true,
  }),
])

describe('genderProduct', () => {
  it('is the product of catalogued constrained parents and is never 1 when both Charmander genders are forced', () => {
    expect(genderProduct(speciesPairNature)).toBeCloseTo(0.125 * 0.875)
    expect(genderProduct(dittoPairNature)).toBe(1)
  })
})

describe('compareRouteCosts', () => {
  it('treats partner identity as outside Q — unconstrained pair and Ditto are equivalent', () => {
    const pair = cost([
      parent({ species: ['Charmander'] }),
      parent({ species: ['Charmander'] }),
    ])
    const ditto = cost([
      parent({ species: ['Charmander'] }),
      parent({ species: ['Ditto'], isDitto: true }),
    ])
    expect(compareRouteCosts(pair, ditto)).toEqual({ outcome: 'equivalent' })
  })

  it('calls Ditto cheaper when Q matches and the gender product is strictly easier', () => {
    expect(compareRouteCosts(speciesPairNature, dittoPairNature)).toEqual({
      outcome: 'cheaper',
      winner: 'b',
    })
  })

  it('does not treat already-knows as a subset of carrier for the same move', () => {
    const pairCarrier = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
      }),
      parent({
        species: ['Gyarados'],
        genderConstrained: true,
        gender: 'male',
        cataloguedGenderRatio: [{ species: 'Gyarados', ratio: { malePercent: 50 } }],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'carrier',
      }),
    ])
    const dittoAlreadyKnows = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'male',
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'already-knows',
      }),
      parent({ species: ['Ditto'], isDitto: true }),
    ])
    expect(compareRouteCosts(pairCarrier, dittoAlreadyKnows)).toEqual({
      outcome: 'incomparable',
    })
  })

  it('does not treat consolidated as a subset of carrier for the same move', () => {
    const pairCarrier = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
        hasTargetNature: true,
      }),
      parent({
        species: ['Salamence'],
        genderConstrained: true,
        gender: 'male',
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'carrier',
      }),
    ])
    const dittoConsolidated = cost([
      parent({
        species: ['Charmander'],
        hasTargetNature: true,
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'consolidated',
      }),
      parent({ species: ['Ditto'], isDitto: true }),
    ])
    expect(compareRouteCosts(pairCarrier, dittoConsolidated)).toEqual({
      outcome: 'incomparable',
    })
  })

  it('does not treat same-species as a subset of carrier for the same move', () => {
    const sameSpecies = cost([
      parent({ species: ['Charmander'] }),
      parent({
        species: ['Charmander'],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'same-species',
      }),
    ])
    const externalCarrier = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
      }),
      parent({
        species: ['Gyarados'],
        genderConstrained: true,
        gender: 'male',
        cataloguedGenderRatio: [{ species: 'Gyarados', ratio: { malePercent: 50 } }],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'carrier',
      }),
    ])
    expect(compareRouteCosts(sameSpecies, externalCarrier)).toEqual({
      outcome: 'incomparable',
    })
  })
})

const fixtureGame = {
  species: {
    FixtureMon: { genderRatio: { malePercent: 50 } },
    FixtureCarrier: { genderRatio: { malePercent: 50 } },
  },
} as unknown as GameData

describe('deriveAcquisitionCost egg-move roles', () => {
  it('records same-species passing when the pair share a species and mustKnow', () => {
    const derived = deriveAcquisitionCost(
      [
        { species: ['FixtureMon'] },
        {
          species: ['FixtureMon'],
          mustKnow: ['FixtureMove'],
          acquisition: [{ code: 'acquire-egg-move-pair' }],
        },
      ],
      fixtureGame,
    )
    expect(derived.parents[1]?.eggMoveRole).toBe('same-species')
    expect(formatAcquisitionCost(derived)).toBe(
      'two FixtureMon, one that knows FixtureMove',
    )
  })

  it('still records an external passer as carrier', () => {
    const derived = deriveAcquisitionCost(
      [
        { species: ['FixtureMon'] },
        {
          species: ['FixtureCarrier'],
          mustKnow: ['FixtureMove'],
          acquisition: [{ code: 'acquire-egg-move-pair' }],
        },
      ],
      fixtureGame,
    )
    expect(derived.parents[1]?.eggMoveRole).toBe('carrier')
  })
})
