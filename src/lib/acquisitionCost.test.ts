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
    genderReasonCodes: [],
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
    genderReasonCodes: ['pair-opposite-genders'],
    cataloguedGenderRatio: [
      { species: 'Charmander', ratio: CHARMANDER_RATIO },
    ],
    hasTargetNature: true,
  }),
  parent({
    species: ['Charmander'],
    genderConstrained: true,
    gender: 'male',
    genderReasonCodes: ['pair-opposite-genders'],
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
      gDiffers: true,
      onlyA: ['moves:carrier:Dragon Dance'],
      onlyB: ['moves:already-knows:Dragon Dance'],
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
      gDiffers: true,
      onlyA: ['moves:carrier:Dragon Dance'],
      onlyB: ['moves:consolidated:Dragon Dance'],
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
      gDiffers: true,
      onlyA: ['moves:same-species:Dragon Dance'],
      onlyB: ['moves:carrier:Dragon Dance'],
    })
  })

  it('records G-versus-extra-Q when the easier hunt has more qualitative work', () => {
    const rareFemale = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
      }),
      parent({ species: ['Charmander'] }),
    ])
    const dittoMasuda = cost([
      parent({ species: ['Charmander'] }),
      parent({
        species: ['Ditto'],
        isDitto: true,
        mustOriginateFromDifferentLanguage: true,
      }),
    ])
    expect(compareRouteCosts(rareFemale, dittoMasuda)).toEqual({
      outcome: 'incomparable',
      gDiffers: true,
      onlyA: [],
      onlyB: ['masuda'],
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

describe('formatAcquisitionCost named gender', () => {
  it('combines scarce allocation gender and nature on the same parent', () => {
    expect(formatAcquisitionCost(speciesPairNature)).toBe(
      'two Charmander, one female with the target nature',
    )
  })

  it('does not name either gender on a 50/50 allocation', () => {
    const gyarados = cost([
      parent({
        species: ['Gyarados'],
        genderConstrained: true,
        gender: 'female',
        genderReasonCodes: ['pair-opposite-genders'],
        cataloguedGenderRatio: [
          { species: 'Gyarados', ratio: { malePercent: 50 } },
        ],
      }),
      parent({
        species: ['Gyarados'],
        genderConstrained: true,
        gender: 'male',
        genderReasonCodes: ['pair-opposite-genders'],
        cataloguedGenderRatio: [
          { species: 'Gyarados', ratio: { malePercent: 50 } },
        ],
      }),
    ])
    expect(formatAcquisitionCost(gyarados)).toBe('two Gyarados')
  })

  it('always names a mechanically required gender, even when it is the majority', () => {
    const dittoAlreadyKnows = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'male',
        genderReasonCodes: ['male-egg-move-eligible'],
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'already-knows',
      }),
      parent({ species: ['Ditto'], isDitto: true }),
    ])
    expect(formatAcquisitionCost(dittoAlreadyKnows)).toBe(
      'one male Charmander that already knows Dragon Dance, plus a Ditto',
    )
  })

  it('names a forced line parent on the carrier route and leaves male carrier as-is', () => {
    const pairCarrier = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        genderReasonCodes: ['female-species-holder'],
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
      }),
      parent({
        species: ['Salamence'],
        genderConstrained: true,
        gender: 'male',
        genderReasonCodes: ['male-external-carrier'],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'carrier',
      }),
    ])
    expect(formatAcquisitionCost(pairCarrier)).toBe(
      'one female Charmander, plus a male Dragon Dance carrier',
    )
  })

  it('keeps Masuda trailing on a two-parent carrier line so partner is not the carrier', () => {
    const pairCarrier = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        genderReasonCodes: ['female-species-holder'],
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
        hasTargetNature: true,
        mustOriginateFromDifferentLanguage: true,
      }),
      parent({
        species: ['Salamence'],
        genderConstrained: true,
        gender: 'male',
        genderReasonCodes: ['male-external-carrier'],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'carrier',
      }),
    ])
    expect(formatAcquisitionCost(pairCarrier)).toBe(
      'one female Charmander with the target nature, plus a male Dragon Dance carrier; the Charmander whose origin language differs from its partner',
    )
  })

  it('combines scarce allocation gender and Masuda on the same parent', () => {
    const pair = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        genderReasonCodes: ['pair-opposite-genders'],
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
        mustOriginateFromDifferentLanguage: true,
      }),
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'male',
        genderReasonCodes: ['pair-opposite-genders'],
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
      }),
    ])
    expect(formatAcquisitionCost(pair)).toBe(
      'two Charmander, one female whose origin language differs from its partner',
    )
  })

  it('keeps attributes on different parents as separate clauses', () => {
    const pair = cost([
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'female',
        genderReasonCodes: ['pair-opposite-genders'],
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
      }),
      parent({
        species: ['Charmander'],
        genderConstrained: true,
        gender: 'male',
        genderReasonCodes: ['pair-opposite-genders'],
        cataloguedGenderRatio: [
          { species: 'Charmander', ratio: CHARMANDER_RATIO },
        ],
        mustKnowMoves: true,
        moves: ['Dragon Dance'],
        eggMoveRole: 'same-species',
      }),
    ])
    expect(formatAcquisitionCost(pair)).toBe(
      'two Charmander, one female; one that knows Dragon Dance',
    )
  })
})
